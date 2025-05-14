@echo off


REM �A�v���P�[�V�����̃��[�g�f�B���N�g�������ϐ��ɐݒ�
REM %~dp0 �̓o�b�`�t�@�C�����u����Ă���f�B���N�g���̃p�X�𖖔���\�t���Ŏ擾���܂�
SET "APP_ROOT=%~dp0"

echo ======================================================
echo  Mastra-CRS-MCP: MCP�T�[�o�[ & Agent �N���X�N���v�g
echo ======================================================
echo.
echo �A�v���P�[�V�������[�g�f�B���N�g��: %APP_ROOT%
echo.

REM �eNode.js�v���W�F�N�g�̈ˑ��C���X�g�[���ƃr���h�A�����ċN�����s���܂��B
REM �V�����E�B���h�E�Ŏ��s���ACtrl+C�ŏI�����Ȃ��悤�� /k �I�v�V�������g�p���܂��B
REM ���ϐ� APP_ROOT �������p���܂��B

REM --- crs-mcp-law-server (�@�߉�� MCP �T�[�o�[) �̃Z�b�g�A�b�v�ƋN�� ---
echo --- 1. �@�߉�� MCP �T�[�o�[�̃Z�b�g�A�b�v (crs-mcp-law-server) ---
cd crs-mcp-law-server
dir
if exist node_modules\ (
    echo node_modules �����݂��܂��B�ˑ��C���X�g�[�����X�L�b�v���܂��B
) else (
    echo �ˑ��p�b�P�[�W���C���X�g�[�����Ă��܂�...
    npm install
    if errorlevel 1 goto npm_error
    echo �ˑ��p�b�P�[�W�̃C���X�g�[�����������܂����B
)
echo TypeScript���r���h���Ă��܂�...
npm run build
if errorlevel 1 goto npm_error
echo �r���h���������܂����B

echo �@�߉�� MCP �T�[�o�[���N�����܂� (�V�����E�B���h�E)...
REM start "Law Server" cmd /k npm run dev
start "Law Server" cmd /k npm run dev

echo.

REM --- crs-mcp-scraper-server (�X�N���C�p�[ MCP �T�[�o�[) �̃Z�b�g�A�b�v�ƋN�� ---
echo --- 2. �X�N���C�p�[ MCP �T�[�o�[�̃Z�b�g�A�b�v (crs-mcp-scraper-server) ---
cd ..
cd crs-mcp-scraper-server
if exist node_modules\ (
    echo node_modules �����݂��܂��B�ˑ��C���X�g�[�����X�L�b�v���܂��B
) else (
    echo �ˑ��p�b�P�[�W���C���X�g�[�����Ă��܂�...
    npm install
    if errorlevel 1 goto npm_error
    echo �ˑ��p�b�P�[�W�̃C���X�g�[�����������܂����B
)
echo TypeScript���r���h���Ă��܂�...
npm run build
if errorlevel 1 goto npm_error
echo �r���h���������܂����B

echo �X�N���C�p�[ MCP �T�[�o�[���N�����܂� (�V�����E�B���h�E)...
REM start "Scraper Server" cmd /k npm run dev
start "Scraper Server" cmd /k npm run dev
echo.

REM --- mastra (Mastra Agent �A�v���P�[�V����) �̃Z�b�g�A�b�v�ƋN�� ---
echo --- 3. Mastra Agent �A�v���P�[�V�����̃Z�b�g�A�b�v (mastra) ---
cd ..
cd mastra
if exist node_modules\ (
    echo node_modules �����݂��܂��B�ˑ��C���X�g�[�����X�L�b�v���܂��B
) else (
    echo �ˑ��p�b�P�[�W���C���X�g�[�����Ă��܂�...
    npm install
    if errorlevel 1 goto npm_error
    echo �ˑ��p�b�P�[�W�̃C���X�g�[�����������܂����B
)
echo TypeScript���r���h���Ă��܂�...
npm run build
if errorlevel 1 goto npm_error
echo �r���h���������܂����B

echo Mastra Agent ���N�����܂� (�V�����E�B���h�E)...
REM start "Mastra Agent" cmd /k npm run dev"
start "Mastra Agent" cmd /k npm run dev

timeout /t 10 /nobreak > NUL
echo Web�u���E�U�� http://localhost:4111/ �ɃA�N�Z�X���Ă��������B
start chrome.exe "http://localhost:4111/"
echo.

echo ======================================================
echo  "���ׂẴT�[�o�[�� Agent �̋N���R�}���h�𔭍s���܂����B"
echo  "�e�E�B���h�E���m�F���Ă��������B"
echo  "���̃E�B���h�E�͎����I�ɕ��܂��B"
echo ======================================================
goto end

:npm_error
echo ======================================================
echo  �G���[: npm �R�}���h�̎��s�Ɏ��s���܂����B
echo  �C���^�[�l�b�g�ڑ����m�F���ANode.js��npm��������
echo  �C���X�g�[������Ă��邩�m�F���Ă��������B
echo  �G���[�ڍׂ͏�L�̃��b�Z�[�W���m�F���Ă��������B
echo ======================================================
pause

:end
EXIT /B %errorlevel%