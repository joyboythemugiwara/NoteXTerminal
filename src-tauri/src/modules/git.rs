use std::process::Command;
use serde::Serialize;
use std::path::Path;

#[derive(Serialize)]
pub struct GitStatus {
    pub branch: String,
    pub root: String,
    pub modified: Vec<String>,
    pub added: Vec<String>,
    pub deleted: Vec<String>,
    pub untracked: Vec<String>,
    pub ahead: usize,
    pub behind: usize,
}

fn git_command() -> Result<Command, String> {
    let candidates: &[&str] = if cfg!(target_os = "windows") {
        &["git.exe", "git"]
    } else {
        &["git", "/usr/bin/git", "/bin/git", "/usr/local/bin/git"]
    };

    for bin in candidates {
        let mut probe = Command::new(bin);
        if probe.arg("--version").output().map(|o| o.status.success()).unwrap_or(false) {
            return Ok(Command::new(bin));
        }
    }

    Err("Git executable not found. Install git and ensure it is available in PATH.".to_string())
}

#[tauri::command]
pub fn git_get_status(path: String) -> Result<GitStatus, String> {
    log::info!("git_get_status for path: {}", path);
    
    // Ensure we have a directory
    let path_obj = Path::new(&path);
    let dir = if path_obj.is_dir() {
        path_obj
    } else {
        path_obj.parent().ok_or_else(|| "Could not get parent directory".to_string())?
    };

    let mut status_cmd = git_command()?;
    let output = status_cmd
        .arg("status")
        .arg("--porcelain")
        .arg("-b")
        .current_dir(dir)
        .output()
        .map_err(|e| {
            log::error!("git status command failed: {}", e);
            e.to_string()
        })?;

    if !output.status.success() {
        log::warn!("git status returned non-zero for {}", dir.display());
        return Err("Not a git repository".to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut branch = String::new();
    let mut modified = Vec::new();
    let mut added = Vec::new();
    let mut deleted = Vec::new();
    let mut untracked = Vec::new();
    let mut ahead = 0;
    let mut behind = 0;

    for line in stdout.lines() {
        if line.starts_with("## ") {
            let info = &line[3..];
            branch = info.split("...").next().unwrap_or("").to_string();
            
            if info.contains("[ahead ") {
                if let Some(s) = info.split("[ahead ").nth(1) {
                    if let Some(n) = s.split(|c: char| !c.is_digit(10)).next() {
                        ahead = n.parse().unwrap_or(0);
                    }
                }
            }
            if info.contains("behind ") {
                if let Some(s) = info.split("behind ").nth(1) {
                    if let Some(n) = s.split(|c: char| !c.is_digit(10)).next() {
                        behind = n.parse().unwrap_or(0);
                    }
                }
            }
            continue;
        }

        if line.len() < 3 {
            continue;
        }

        let status = &line[0..2];
        let file = line[3..].to_string();

        match status {
            " M" | "M " | "R " | " R" => modified.push(file),
            " A" | "A " => added.push(file),
            " D" | "D " => deleted.push(file),
            "??" => untracked.push(file),
            _ => {}
        }
    }

    let mut root_cmd = git_command()?;
    let root_output = root_cmd
        .arg("rev-parse")
        .arg("--show-toplevel")
        .current_dir(dir)
        .output()
        .map_err(|e| e.to_string())?;
    
    let root = if root_output.status.success() {
        let r = String::from_utf8_lossy(&root_output.stdout).trim().to_string();
        #[cfg(windows)]
        {
            r.replace('\\', "/")
        }
        #[cfg(not(windows))]
        {
            r
        }
    } else {
        dir.to_string_lossy().to_string()
    };

    Ok(GitStatus {
        branch,
        root,
        modified,
        added,
        deleted,
        untracked,
        ahead,
        behind,
    })
}

#[tauri::command]
pub fn git_sync(path: String) -> Result<(), String> {
    let path_obj = Path::new(&path);
    let dir = if path_obj.is_dir() {
        path_obj
    } else {
        path_obj.parent().ok_or_else(|| "Could not get parent directory".to_string())?
    };

    let mut fetch_cmd = git_command()?;
    let _ = fetch_cmd
        .arg("fetch")
        .current_dir(dir)
        .output()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn git_list_branches(path: String) -> Result<Vec<String>, String> {
    let path_obj = Path::new(&path);
    let dir = if path_obj.is_dir() {
        path_obj
    } else {
        path_obj.parent().ok_or_else(|| "Could not get parent directory".to_string())?
    };

    let mut branch_cmd = git_command()?;
    let output = branch_cmd
        .arg("branch")
        .arg("--format=%(refname:short)")
        .current_dir(dir)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err("Failed to list branches".to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(stdout.lines().map(|s| s.to_string()).collect())
}

#[tauri::command]
pub fn git_checkout_branch(path: String, branch: String) -> Result<(), String> {
    let path_obj = Path::new(&path);
    let dir = if path_obj.is_dir() {
        path_obj
    } else {
        path_obj.parent().ok_or_else(|| "Could not get parent directory".to_string())?
    };

    let mut checkout_cmd = git_command()?;
    let output = checkout_cmd
        .arg("checkout")
        .arg(&branch)
        .current_dir(dir)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(stderr.to_string());
    }

    Ok(())
}

#[tauri::command]
pub fn git_commit_all(path: String, message: String) -> Result<(), String> {
    let path_obj = Path::new(&path);
    let dir = if path_obj.is_dir() {
        path_obj
    } else {
        path_obj.parent().ok_or_else(|| "Could not get parent directory".to_string())?
    };

    // Stage all changes
    let mut add_cmd = git_command()?;
    let _ = add_cmd
        .arg("add")
        .arg("-A")
        .current_dir(dir)
        .output()
        .map_err(|e| e.to_string())?;

    // Commit
    let mut commit_cmd = git_command()?;
    let output = commit_cmd
        .arg("commit")
        .arg("-m")
        .arg(&message)
        .current_dir(dir)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(stderr.to_string());
    }

    Ok(())
}

#[tauri::command]
pub fn git_push(path: String) -> Result<(), String> {
    let path_obj = Path::new(&path);
    let dir = if path_obj.is_dir() {
        path_obj
    } else {
        path_obj.parent().ok_or_else(|| "Could not get parent directory".to_string())?
    };

    let mut push_cmd = git_command()?;
    let output = push_cmd
        .arg("push")
        .current_dir(dir)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(stderr.to_string());
    }

    Ok(())
}

#[tauri::command]
pub fn git_pull(path: String) -> Result<(), String> {
    let path_obj = Path::new(&path);
    let dir = if path_obj.is_dir() {
        path_obj
    } else {
        path_obj.parent().ok_or_else(|| "Could not get parent directory".to_string())?
    };

    let mut pull_cmd = git_command()?;
    let output = pull_cmd
        .arg("pull")
        .current_dir(dir)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(stderr.to_string());
    }

    Ok(())
}
