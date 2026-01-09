#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(feature = "embedded-assets")]
use include_dir::{include_dir, Dir};
use percent_encoding::percent_decode_str;
use std::fs;
use std::path::{Component, Path, PathBuf};
use tauri::http::{Request, Response, ResponseBuilder};
use tauri::WindowUrl;

#[cfg(feature = "embedded-assets")]
static EMBEDDED_ASSETS: Dir = include_dir!("../build");

fn normalize_relative_path(path: &str) -> Option<PathBuf> {
    let mut buf = PathBuf::new();
    for component in Path::new(path).components() {
        match component {
            Component::Normal(part) => buf.push(part),
            Component::ParentDir => {
                if !buf.pop() {
                    return None;
                }
            }
            Component::CurDir => {}
            Component::RootDir | Component::Prefix(_) => return None,
        }
    }
    Some(buf)
}

fn safe_resolve_file_path(static_root: &Path, url_path: &str) -> Option<PathBuf> {
    let trimmed = url_path.trim_start_matches('/');
    let decoded = percent_decode_str(trimmed).decode_utf8().ok()?;
    let normalized = normalize_relative_path(&decoded)?;
    Some(static_root.join(normalized))
}

fn content_type_for_ext(ext: &str) -> &'static str {
    match ext {
        "html" => "text/html; charset=utf-8",
        "js" => "application/javascript; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "json" => "application/json; charset=utf-8",
        "wasm" => "application/wasm",
        "svg" => "image/svg+xml",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "avif" => "image/avif",
        "ico" => "image/x-icon",
        "woff2" => "font/woff2",
        "map" => "application/json; charset=utf-8",
        "txt" => "text/plain; charset=utf-8",
        _ => "application/octet-stream",
    }
}

fn wants_html(request: &Request) -> bool {
    let accept = request
        .headers()
        .get("accept")
        .and_then(|value| value.to_str().ok())
        .unwrap_or("")
        .to_ascii_lowercase();
    accept.contains("text/html") || accept.contains("*/*")
}

fn with_common_headers(builder: ResponseBuilder) -> ResponseBuilder {
    builder
        .header("Cache-Control", "no-cache")
        .header("Cross-Origin-Embedder-Policy", "require-corp")
        .header("Cross-Origin-Opener-Policy", "same-origin")
}

fn file_response(file_path: &Path, body: Vec<u8>) -> Result<Response, Box<dyn std::error::Error>> {
    let ext = file_path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("");
    let content_type = content_type_for_ext(ext);
    let mimetype = content_type.split(';').next().unwrap_or(content_type);
    with_common_headers(ResponseBuilder::new().status(200).mimetype(mimetype))
        .header("Content-Type", content_type)
        .body(body)
}

fn text_response(status: u16, body: &str) -> Result<Response, Box<dyn std::error::Error>> {
    with_common_headers(ResponseBuilder::new().status(status))
        .header("Content-Type", "text/plain; charset=utf-8")
        .body(body.as_bytes().to_vec())
}

fn request_path(request: &Request) -> String {
    let uri = request.uri();
    let without_scheme = match uri.split_once("://") {
        Some((_scheme, rest)) => match rest.find('/') {
            Some(idx) => &rest[idx..],
            None => "/",
        },
        None => uri,
    };
    let without_query = without_scheme.split('?').next().unwrap_or(without_scheme);
    let without_fragment = without_query.split('#').next().unwrap_or(without_query);
    if without_fragment.is_empty() {
        "/".to_string()
    } else {
        without_fragment.to_string()
    }
}

fn resolve_static_root(app: &tauri::AppHandle) -> Result<PathBuf, Box<dyn std::error::Error>> {
    if let Some(resource_dir) = app.path_resolver().resource_dir() {
        let candidate = resource_dir.join("build");
        if candidate.is_dir() {
            return Ok(candidate);
        }
    }

    if let Ok(executable) = std::env::current_exe() {
        if let Some(exe_dir) = executable.parent() {
            let candidate = exe_dir.join("build");
            if candidate.is_dir() {
                return Ok(candidate);
            }
        }
    }

    Err("Missing static root".into())
}

fn response_for_bytes(path: &str, body: Vec<u8>) -> Result<Response, Box<dyn std::error::Error>> {
    let ext = Path::new(path)
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("");
    let content_type = content_type_for_ext(ext);
    let mimetype = content_type.split(';').next().unwrap_or(content_type);
    with_common_headers(ResponseBuilder::new().status(200).mimetype(mimetype))
        .header("Content-Type", content_type)
        .body(body)
}

fn serve_asset(
    app: &tauri::AppHandle,
    request: &Request,
) -> Result<Response, Box<dyn std::error::Error>> {
    let static_root = resolve_static_root(app).ok();

    let mut path = request_path(request);
    if path == "/editor" {
        path = "/".to_string();
    }
    if path.ends_with('/') {
        path.push_str("index.html");
    }
    if path.is_empty() {
        path = "/index.html".to_string();
    }

    if let Some(ref static_root) = static_root {
        let mut file_path = match safe_resolve_file_path(&static_root, &path) {
            Some(path) => path,
            None => return text_response(404, "Not Found"),
        };

        if file_path.is_dir() {
            file_path = file_path.join("index.html");
        }

        if file_path.exists() {
            let bytes = fs::read(&file_path)?;
            return file_response(&file_path, bytes);
        }
    }

    #[cfg(feature = "embedded-assets")]
    {
        let mut embedded_path = path.clone();
        if embedded_path.starts_with('/') {
            embedded_path.remove(0);
        }
        if embedded_path.is_empty() {
            embedded_path = "index.html".to_string();
        }

        if let Some(file) = EMBEDDED_ASSETS.get_file(&embedded_path) {
            return response_for_bytes(&embedded_path, file.contents().to_vec());
        }
    }

    if wants_html(request) {
        if let Some(ref static_root) = static_root {
            if let Some(index_path) = safe_resolve_file_path(&static_root, "/index.html") {
                if index_path.exists() {
                    let bytes = fs::read(&index_path)?;
                    return file_response(&index_path, bytes);
                }
            }
        }

        #[cfg(feature = "embedded-assets")]
        {
            if let Some(file) = EMBEDDED_ASSETS.get_file("index.html") {
                return response_for_bytes("index.html", file.contents().to_vec());
            }
        }
    }

    text_response(404, "Not Found")
}

fn main() {
    tauri::Builder::default()
        .register_uri_scheme_protocol("squoosh", move |app, request| {
            Ok(serve_asset(app, request)?)
        })
        .setup(|app| {
            let url = if cfg!(debug_assertions) {
                "http://localhost:5000"
            } else {
                "squoosh://localhost/"
            };
            let window_url = url
                .parse()
                .map(WindowUrl::External)
                .map_err(|err| err.to_string())?;
            tauri::WindowBuilder::new(app, "main", window_url)
                .title("Squoosh-Desktop")
                .inner_size(1200.0, 800.0)
                .build()
                .map_err(|err| err.to_string())?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error running tauri app");
}
