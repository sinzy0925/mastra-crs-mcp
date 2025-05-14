@echo off



echo ======================================================
echo  Mastra-CRS-MCP: Gemini API�L�[�ݒ�
echo ======================================================
echo.
echo Gemini (Google Generative AI) �� API �L�[��ݒ肵�܂��B
echo.
echo "�ȉ��̃y�[�W��Web�u���E�U�ŊJ���āAAPI �L�[���擾���Ă��������B"
echo "API �L�[ �̎擾�ɂ� Google �A�J�E���g���K�v�ł��B"
echo.
echo https://aistudio.google.com/apikey
echo.
echo ��LURL���u���E�U�ŊJ���܂�...
echo.

REM Gemini API�L�[�擾�y�[�W���u���E�U�ŊJ��
start "" "https://aistudio.google.com/apikey"
echo �u���E�U���J���Ȃ��ꍇ�́A��L��URL���R�s�[���Ď蓮�ŊJ���Ă��������B
echo.

echo ------------------------------------------------------
echo "�u���E�U�� API �L�[���擾������A�ȉ��ɓ\��t���� Enter �������Ă��������B"
echo "(�L�[�͉�ʂɕ\������܂���)"
echo ------------------------------------------------------

set /p GEMINI_API_KEY=API�L�[����͂��Ă�������: 

echo.
echo ���͂��ꂽ�L�[: %GEMINI_API_KEY:~0,5%...

REM API�L�[�� .env �t�@�C���ɏ�������
REM .env �t�@�C�����Ȃ���ΐV�K�쐬�A����ΒǋL�܂��͍X�V

echo GOOGLE_GENERATIVE_AI_API_KEY=%GEMINI_API_KEY% > mastra\.env

echo.
echo ======================================================
echo  API�L�[�� mastra\.env �ɕۑ����܂����B
echo ======================================================
echo.
echo "����ŔF�؂�API�L�[�̐ݒ�͊����ł��B"
echo "���ɁA03_start_servers_and_agent.bat�����s���ăA�v���P�[�V�������N�����Ă��������B"
echo.
start 03_start_servers_and_agent.bat
EXIT /B 0