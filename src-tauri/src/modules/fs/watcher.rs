use notify::{Config, RecommendedWatcher, RecursiveMode, Watcher};
use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::{Emitter, Runtime};

pub struct WatcherState {
    pub watcher: Arc<Mutex<Option<RecommendedWatcher>>>,
    pub watched_paths: Arc<Mutex<HashSet<PathBuf>>>,
}

impl Default for WatcherState {
    fn default() -> Self {
        Self {
            watcher: Arc::new(Mutex::new(None)),
            watched_paths: Arc::new(Mutex::new(HashSet::new())),
        }
    }
}

#[tauri::command]
pub fn fs_watcher_start<R: Runtime>(app: tauri::AppHandle<R>, state: tauri::State<'_, WatcherState>) -> Result<(), String> {
    let mut watcher_lock = state.watcher.lock().map_err(|e| e.to_string())?;
    if watcher_lock.is_some() {
        return Ok(());
    }

    let watched_paths = state.watched_paths.clone();
    let app_handle = app.clone();

    let watcher = RecommendedWatcher::new(
        move |res: notify::Result<notify::Event>| {
            if let Ok(event) = res {
                // We emit the paths that changed to the frontend.
                // The frontend will determine if it needs to refresh specific directories.
                for path in event.paths {
                    let path_str = path.to_string_lossy().to_string().replace('\\', "/");
                    let _ = app_handle.emit("fs://changed", path_str);
                }
            }
        },
        Config::default(),
    )
    .map_err(|e| e.to_string())?;

    *watcher_lock = Some(watcher);
    watched_paths.lock().unwrap().clear();

    Ok(())
}

#[tauri::command]
pub fn fs_watcher_stop(state: tauri::State<'_, WatcherState>) -> Result<(), String> {
    let mut watcher_lock = state.watcher.lock().map_err(|e| e.to_string())?;
    *watcher_lock = None;
    state.watched_paths.lock().unwrap().clear();
    Ok(())
}

#[tauri::command]
pub fn fs_watcher_add(path: String, state: tauri::State<'_, WatcherState>) -> Result<(), String> {
    let mut watcher_lock = state.watcher.lock().map_err(|e| e.to_string())?;
    let watcher = watcher_lock.as_mut().ok_or("watcher not started")?;

    let p = PathBuf::from(&path);
    if !p.exists() {
        return Err("path does not exist".into());
    }

    let mut watched = state.watched_paths.lock().unwrap();
    if watched.contains(&p) {
        return Ok(());
    }

    watcher
        .watch(&p, RecursiveMode::NonRecursive)
        .map_err(|e| e.to_string())?;
    
    watched.insert(p);
    Ok(())
}

#[tauri::command]
pub fn fs_watcher_remove(path: String, state: tauri::State<'_, WatcherState>) -> Result<(), String> {
    let mut watcher_lock = state.watcher.lock().map_err(|e| e.to_string())?;
    let watcher = watcher_lock.as_mut().ok_or("watcher not started")?;

    let p = PathBuf::from(&path);
    let mut watched = state.watched_paths.lock().unwrap();
    if !watched.contains(&p) {
        return Ok(());
    }

    let _ = watcher.unwatch(&p);
    watched.remove(&p);
    Ok(())
}
