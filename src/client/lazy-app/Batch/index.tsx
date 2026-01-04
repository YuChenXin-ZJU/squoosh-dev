import { h, Component } from 'preact';

import * as style from './style.css';
import 'add-css:./style.css';

import WorkerBridge from '../worker-bridge';
import type { Locale } from '../util';
import {
  abortable,
  assertSignal,
  builtinDecode,
  canDecodeImageType,
  getLocale,
  onLocaleChange,
  sniffMimeType,
  t,
  toggleLocale,
} from '../util';
import { EncoderType, encoderMap } from '../feature-meta';
import { zipSync, strToU8 } from 'fflate';

type ItemStatus = 'pending' | 'processing' | 'done' | 'error';

interface BatchItem {
  id: string;
  file: File;
  status: ItemStatus;
  error?: string;
  outputFile?: File;
  downloadUrl?: string;
  progress: number;
}

interface Props {
  files: File[];
  onBack: () => void;
}

interface State {
  items: BatchItem[];
  locale: Locale;
  encoderType: EncoderType;
  compression?: number;
  running: boolean;
}

function makeId() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function getDefaultEncoderType(): EncoderType {
  return 'mozJPEG';
}

function cloneOptions<T extends object>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function defaultCompressionForEncoder(encoderType: EncoderType) {
  const encoder = encoderMap[encoderType];
  const options: any = encoder.meta.defaultOptions as any;
  if (typeof options.quality !== 'number') return undefined;
  return clampNumber(100 - options.quality, 0, 99);
}

function prettyBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = units[0];
  for (let i = 1; i < units.length && value >= 1024; i++) {
    value /= 1024;
    unit = units[i];
  }
  return `${value.toFixed(value < 10 ? 2 : value < 100 ? 1 : 0)} ${unit}`;
}

async function decodeImage(
  signal: AbortSignal,
  blob: Blob,
  workerBridge: WorkerBridge,
): Promise<ImageData> {
  assertSignal(signal);
  const mimeType = await abortable(signal, sniffMimeType(blob));
  const canDecode = await abortable(signal, canDecodeImageType(mimeType));

  try {
    if (!canDecode) {
      if (mimeType === 'image/avif') return await workerBridge.avifDecode(signal, blob);
      if (mimeType === 'image/webp') return await workerBridge.webpDecode(signal, blob);
      if (mimeType === 'image/jxl') return await workerBridge.jxlDecode(signal, blob);
      if (mimeType === 'image/webp2') return await workerBridge.wp2Decode(signal, blob);
      if (mimeType === 'image/qoi') return await workerBridge.qoiDecode(signal, blob);
    }
    return await builtinDecode(signal, blob);
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') throw err;
    throw Error("Couldn't decode image");
  }
}

export default class Batch extends Component<Props, State> {
  private abortController?: AbortController;
  private workerBridge = new WorkerBridge();
  private removeLocaleListener?: () => void;

  state: State = {
    items: this.props.files.map((file) => ({
      id: makeId(),
      file,
      status: 'pending',
      progress: 0,
    })),
    locale: getLocale(),
    encoderType: getDefaultEncoderType(),
    compression: defaultCompressionForEncoder(getDefaultEncoderType()),
    running: false,
  };

  componentDidMount() {
    this.removeLocaleListener = onLocaleChange((locale) => {
      this.setState({ locale });
    });
  }

  componentWillUnmount() {
    this.removeLocaleListener?.();
    this.abort();
    for (const item of this.state.items) {
      if (item.downloadUrl) URL.revokeObjectURL(item.downloadUrl);
    }
  }

  private abort = () => {
    if (!this.abortController) return;
    this.abortController.abort();
    this.abortController = undefined;
    this.setState({ running: false });
  };

  private reset = () => {
    this.abort();
    for (const item of this.state.items) {
      if (item.downloadUrl) URL.revokeObjectURL(item.downloadUrl);
    }
    this.setState((prev) => ({
      items: prev.items.map((item) => ({
        ...item,
        status: 'pending',
        error: undefined,
        outputFile: undefined,
        downloadUrl: undefined,
        progress: 0,
      })),
    }));
  };

  private getEncodeOptions() {
    const encoder = encoderMap[this.state.encoderType];
    const options: any = cloneOptions(encoder.meta.defaultOptions as any);
    if (
      typeof this.state.compression === 'number' &&
      typeof options.quality === 'number'
    ) {
      options.quality = clampNumber(100 - this.state.compression, 1, 100);
    }
    return options;
  }

  private run = async () => {
    if (this.state.running) return;

    this.abortController = new AbortController();
    const { signal } = this.abortController;
    this.setState({ running: true });

    const options = this.getEncodeOptions();
    const encoder = encoderMap[this.state.encoderType];

    for (const item of this.state.items) {
      if (signal.aborted) break;

      this.setState((prev) => ({
        items: prev.items.map((x) =>
          x.id === item.id ? { ...x, status: 'processing', progress: 0.1 } : x,
        ),
      }));

      try {
        const decoded = await decodeImage(signal, item.file, this.workerBridge);
        const encodedBytes = await encoder.encode(signal, this.workerBridge, decoded, options as any);
        const outputFile = new File(
          [encodedBytes],
          item.file.name.replace(/.[^.]*$/, `.${encoder.meta.extension}`),
          { type: encoder.meta.mimeType },
        );
        const downloadUrl = URL.createObjectURL(outputFile);

        this.setState((prev) => ({
          items: prev.items.map((x) =>
            x.id === item.id
              ? { ...x, status: 'done', progress: 1, outputFile, downloadUrl }
              : x,
          ),
        }));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed';
        this.setState((prev) => ({
          items: prev.items.map((x) =>
            x.id === item.id ? { ...x, status: 'error', error: message, progress: 1 } : x,
          ),
        }));
      }
    }

    this.abortController = undefined;
    this.setState({ running: false });
  };

  private onEncoderChange = (event: Event) => {
    const value = (event.target as HTMLSelectElement).value as EncoderType;
    this.setState({
      encoderType: value,
      compression: defaultCompressionForEncoder(value),
    });
  };

  private onCompressionChange = (event: Event) => {
    const value = Number((event.target as HTMLInputElement).value);
    this.setState({ compression: value });
  };

  private shouldShowCompression() {
    const encoder = encoderMap[this.state.encoderType];
    const options: any = encoder.meta.defaultOptions as any;
    return typeof options.quality === 'number';
  }

  private derivedQuality() {
    const encoder = encoderMap[this.state.encoderType];
    const options: any = encoder.meta.defaultOptions as any;
    if (typeof options.quality !== 'number') return undefined;
    const compression = this.state.compression ?? defaultCompressionForEncoder(this.state.encoderType) ?? 0;
    return clampNumber(100 - compression, 1, 100);
  }

  private downloadItem = (item: BatchItem) => {
    if (!item.downloadUrl || !item.outputFile) return;
    const a = document.createElement('a');
    a.href = item.downloadUrl;
    a.download = item.outputFile.name;
    a.click();
  };

  private downloadAllZip = () => {
    const files = this.state.items
      .filter((i) => i.outputFile)
      .map((i) => i.outputFile!) as File[];

    if (files.length === 0) return;

    const zipInput: Record<string, Uint8Array> = {};
    for (const file of files) {
      zipInput[file.name] = new Uint8Array([]);
    }

    Promise.all(
      files.map(async (file) => ({
        name: file.name,
        bytes: new Uint8Array(await file.arrayBuffer()),
      })),
    ).then((entries) => {
      for (const entry of entries) zipInput[entry.name] = entry.bytes;
      zipInput['README.txt'] = strToU8(
        `Created by Squoosh-Desktop\nFiles: ${files.length}\n`,
      );

      const zipped = zipSync(zipInput, { level: 6 });
      const blob = new Blob([zipped], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Squoosh-Desktop-${Date.now()}.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    });
  };

  render({ onBack }: Props, { items, encoderType, running, locale }: State) {
    const total = items.length;
    const done = items.filter((i) => i.status === 'done').length;
    const error = items.filter((i) => i.status === 'error').length;

    return (
      <div class={style.page}>
        <div class={style.shell}>
          <div class={style.topbar}>
            <div class={style.title}>
              {t(locale, { zh: '批量压缩', en: 'Batch compress' })}
            </div>
            <div class={style.actions}>
              <button class={style.button} onClick={onBack} disabled={running}>
                {t(locale, { zh: '返回', en: 'Back' })}
              </button>
              <button class={style.button} onClick={this.reset} disabled={running}>
                {t(locale, { zh: '重置', en: 'Reset' })}
              </button>
              <button
                class={style.button}
                onClick={this.downloadAllZip}
                disabled={running || done === 0}
              >
                {t(locale, { zh: '下载全部(zip)', en: 'Download all (zip)' })}
              </button>
              <button
                class={style.button}
                type="button"
                onClick={() => this.setState({ locale: toggleLocale() })}
              >
                {locale === 'zh' ? '中文' : 'EN'}
              </button>
              {running ? (
                <button class={style.button} onClick={this.abort}>
                  {t(locale, { zh: '停止', en: 'Stop' })}
                </button>
              ) : (
                <button
                  class={`${style.button} ${style.buttonPrimary}`}
                  onClick={this.run}
                >
                  {t(locale, { zh: '开始', en: 'Start' })}
                </button>
              )}
            </div>
          </div>

          <div class={style.controls}>
            <label class={style.control}>
              <span class={style.controlLabel}>
                {t(locale, { zh: '输出格式', en: 'Output format' })}
              </span>
              <select
                class={style.select}
                value={encoderType}
                onChange={this.onEncoderChange}
              >
                {Object.entries(encoderMap).map(([type, encoder]) => (
                  <option value={type}>{encoder.meta.label}</option>
                ))}
              </select>
            </label>
            {this.shouldShowCompression() && (
              <label class={style.control}>
                <span class={style.controlLabel}>
                  {t(locale, { zh: '压缩强度', en: 'Compression' })}
                </span>
                <input
                  class={style.range}
                  type="range"
                  min="0"
                  max="99"
                  value={this.state.compression ?? defaultCompressionForEncoder(encoderType) ?? 0}
                  onInput={this.onCompressionChange}
                />
                <span class={style.controlValue}>
                  {this.state.compression ?? defaultCompressionForEncoder(encoderType) ?? 0}
                  {this.derivedQuality() != null
                    ? t(locale, {
                        zh: `（质量 ${this.derivedQuality()}）`,
                        en: ` (quality ${this.derivedQuality()})`,
                      })
                    : ''}
                </span>
              </label>
            )}
            <div class={`${style.meta} ${style.summary}`}>
              {t(locale, { zh: '总计', en: 'Total' })} {total}，{t(locale, { zh: '完成', en: 'Done' })}{' '}
              {done}，{t(locale, { zh: '失败', en: 'Failed' })} {error}
            </div>
          </div>

          <div class={style.content}>
            {items.length === 0 ? (
              <div class={style.empty}>
                {t(locale, {
                  zh: '拖拽多张图片到首页后进入这里',
                  en: 'Drag multiple images on the home page to enter here',
                })}
              </div>
            ) : (
              <div class={style.list}>
                {items.map((item) => (
                  <div class={style.item} key={item.id}>
                    <div class={style.row}>
                      <div>{item.file.name}</div>
                      <div class={style.status}>
                        {item.status === 'pending'
                          ? t(locale, { zh: '待处理', en: 'Pending' })
                          : item.status === 'processing'
                            ? t(locale, { zh: '处理中', en: 'Processing' })
                            : item.status === 'done'
                              ? t(locale, { zh: '完成', en: 'Done' })
                              : t(locale, { zh: '失败', en: 'Failed' })}
                      </div>
                    </div>
                    <div class={style.row}>
                      <div class={style.meta}>
                        {t(locale, { zh: '原始', en: 'Original' })}{' '}
                        {prettyBytes(item.file.size)}
                        {item.outputFile
                          ? ` → ${t(locale, { zh: '输出', en: 'Output' })} ${prettyBytes(
                              item.outputFile.size,
                            )} ${t(locale, {
                              zh: `（占原图 ${Math.round((item.outputFile.size / item.file.size) * 100)}%）`,
                              en: `(${Math.round((item.outputFile.size / item.file.size) * 100)}% of original)`,
                            })}`
                          : ''}
                      </div>
                      <div>
                        <button
                          class={style.button}
                          onClick={() => this.downloadItem(item)}
                          disabled={!item.outputFile}
                        >
                          {t(locale, { zh: '下载', en: 'Download' })}
                        </button>
                      </div>
                    </div>
                    <div class={style.progress}>
                      <div
                        class={style.progressBar}
                        style={{ width: `${Math.round(item.progress * 100)}%` }}
                      />
                    </div>
                    {item.error && <div class={style.meta}>{item.error}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
}

