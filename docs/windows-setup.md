# Windows Setup
Install `https://scoop.sh/` on windows
```sh
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
Invoke-RestMethod -Uri https://get.scoop.sh | Invoke-Expression
```

Install visual studio C++ redistributable from [here](https://www.microsoft.com/en-us/download/details.aspx?id=52685)

Install `git` from [here](https://git-scm.com/download/win)

Install `nvm` from [here](https://github.com/coreybutler/nvm-windows/releases)

Install just:
```shell
scoop install just
```

Install pyenv
```shell
scoop install main/pyenv
```

Set up pyenv
```shell
pyenv install 3.12.8
pyenv global 3.12.8
```

Install pipx
```shell
scoop install pipx
```

Install 1password-cli
```shell
scoop install main/1password-cli
```

Install uv
```shell
scoop install main/uv
```

Setup nvm
```shell
nvm install 22.7.0
nvm use 22.7.0
``


Download docker desktop from [here](https://www.docker.com/products/docker-desktop)

Follow the normal setup instructions for here in the main Readme
