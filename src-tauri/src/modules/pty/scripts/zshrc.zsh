# notex-shell-integration (zshrc)

{
  _notex_user_zdotdir="${NOTEX_USER_ZDOTDIR:-$HOME}"
  [ -f "$_notex_user_zdotdir/.zshrc" ] && source "$_notex_user_zdotdir/.zshrc"
  unset _notex_user_zdotdir
}

if [[ -z "$__NOTEX_HOOKS_LOADED" ]]; then
  __NOTEX_HOOKS_LOADED=1
  autoload -Uz add-zsh-hook 2>/dev/null
  autoload -Uz vcs_info 2>/dev/null

  # VCS info setup (for branch name)
  zstyle ':vcs_info:*' enable git
  zstyle ':vcs_info:git:*' formats ' [ %b]'
  zstyle ':vcs_info:git:*' actionformats ' [ %b|%a]'

  _notex_urlencode() {
    emulate -L zsh
    setopt localoptions no_multibyte
    local LC_ALL=C s="$1" i byte
    for (( i=1; i<=${#s}; i++ )); do
      byte="${s[i]}"
      case "$byte" in
        [a-zA-Z0-9/._~-]) printf '%s' "$byte" ;;
        *) printf '%%%02X' "'$byte" ;;
      esac
    done
  }

  _notex_precmd() {
    local _notex_ret=$?
    
    # Update VCS info
    vcs_info
    
    printf '\e]133;D;%s\e\\' "$_notex_ret"
    printf '\e]7;file://%s%s\e\\' "${HOST}" "$(_notex_urlencode "$PWD")"
    
    # Re-inject NoteX prompt if PS1 was clobbered or first run
    if [[ "$PS1" != *$'\e]133;B\e\\'* ]]; then
      local user_host='%F{green}%n%f@%F{green}%m%f'
      local cwd='%F{blue}%~%f'
      local git_branch='%F{cyan}${vcs_info_msg_0_}%f'
      local suffix=' %F{green}%#%f '
      
      PS1=$'%{\e]133;B\e\\%}'"$user_host:$cwd$git_branch$suffix"
    fi
    printf '\e]133;A\e\\'
  }

  _notex_preexec() {
    printf '\e]133;C\e\\'
  }

  if (( $+functions[add-zsh-hook] )); then
    add-zsh-hook precmd _notex_precmd
    add-zsh-hook preexec _notex_preexec
  fi

  _notex_precmd
fi
:
