# notex-shell-integration (init.fish)

# Skip if not interactive
status is-interactive; or exit

if not set -q __NOTEX_HOOKS_LOADED
    set -g __NOTEX_HOOKS_LOADED 1

    function _notex_urlencode
        python3 -c "import urllib.parse, sys; print(urllib.parse.quote(sys.stdin.read(), safe=''))"
    end

    function _notex_precmd --on-event fish_prompt
        set -l last_status $status
        printf "\e]133;D;%s\e\\" $last_status
        
        set -l hostname (hostname)
        set -l encoded_pwd (pwd | _notex_urlencode)
        printf "\e]7;file://%s%s\e\\" $hostname $encoded_pwd
        printf "\e]133;A\e\\"
    end

    function _notex_preexec --on-event fish_preexec
        printf "\e]133;C\e\\"
    end

    # Beautiful NoteX Fish Prompt
    function fish_prompt
        printf "\e]133;B\e\\"
        
        set_color green
        printf "%s" $USER
        set_color normal
        printf "@"
        set_color green
        printf "%s" (hostname)
        set_color normal
        printf ":"
        set_color blue
        printf "%s" (prompt_pwd)
        set_color normal

        # Git branch
        set -l branch (fish_git_prompt)
        if test -n "$branch"
            set_color cyan
            printf " [ %s]" (string trim $branch)
            set_color normal
        end

        set_color green
        printf " > "
        set_color normal
    end
end
