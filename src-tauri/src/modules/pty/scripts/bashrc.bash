# notex-shell-integration (bashrc)

if [ -z "$__NOTEX_HOOKS_LOADED" ]; then
  __NOTEX_HOOKS_LOADED=1

  [ -f /etc/profile ] && source /etc/profile
  [ -f /etc/bashrc ] && source /etc/bashrc
  if [ -f "$HOME/.bash_profile" ]; then
    source "$HOME/.bash_profile"
  elif [ -f "$HOME/.bash_login" ]; then
    source "$HOME/.bash_login"
  elif [ -f "$HOME/.profile" ]; then
    source "$HOME/.profile"
  fi
  [ -f "$HOME/.bashrc" ] && source "$HOME/.bashrc"

  _notex_urlencode() {
    local LC_ALL=C s="$1" i c
    for (( i=0; i<${#s}; i++ )); do
      c="${s:i:1}"
      case "$c" in
        [a-zA-Z0-9/._~-]) printf '%s' "$c" ;;
        *) printf '%%%02X' "'$c" ;;
      esac
    done
  }

  _notex_git_prompt() {
    local branch
    if branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null); then
      printf " \e[36m[ %s]\e[0m" "$branch"
    fi
  }

  _notex_precmd() {
    local _notex_ret=$?
    printf '\e]133;D;%s\e\\' "$_notex_ret"
    printf '\e]7;file://%s%s\e\\' "${HOSTNAME:-$(uname -n 2>/dev/null)}" "$(_notex_urlencode "$PWD")"
    
    if [ -z "$__NOTEX_PS1_INJECTED" ]; then
      # Build a beautiful NoteX prompt: [user@host:dir (branch)] $
      local user_host='\[\e[32m\]\u\[\e[m\]@\[\e[32m\]\h\[\e[m\]'
      local cwd='\[\e[34m\]\w\[\e[m\]'
      local suffix=' \[\e[1;32m\]$\[\e[m\] '
      
      # We inject the OSC 133;B marker for command completion tracking.
      PS1='\[\e]133;B\e\\\]'"$user_host:$cwd\$(_notex_git_prompt)$suffix"
      __NOTEX_PS1_INJECTED=1
    fi
    printf '\e]133;A\e\\'
  }

  case ":${PROMPT_COMMAND:-}:" in
    *":_notex_precmd:"*) ;;
    *) PROMPT_COMMAND="_notex_precmd${PROMPT_COMMAND:+;$PROMPT_COMMAND}" ;;
  esac

  if [ "${BASH_VERSINFO[0]:-0}" -gt 4 ] \
     || { [ "${BASH_VERSINFO[0]:-0}" -eq 4 ] && [ "${BASH_VERSINFO[1]:-0}" -ge 4 ]; }; then
    PS0='\[\e]133;C\e\\\]'"${PS0:-}"
  fi

  _notex_precmd
fi
:
