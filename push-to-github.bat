@echo off
echo ========================================
echo Zinergia - Git Push Script
echo ========================================
echo.
echo This script will push your commits to GitHub.
echo You will be prompted for authentication.
echo.
echo IMPORTANT: When prompted for credentials:
echo - Username: Use your GitHub username OR email
echo - Password: Use a Personal Access Token (NOT your GitHub password)
echo.
echo To create a Personal Access Token:
echo 1. Go to: https://github.com/settings/tokens
echo 2. Click "Generate new token" -^> "Generate new token (classic)"
echo 3. Select 'repo' scope
echo 4. Generate and copy the token
echo.
echo ========================================
echo.
pause

echo.
echo Pushing to GitHub...
echo.

git push origin main

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo SUCCESS! Push completed.
    echo ========================================
) else (
    echo.
    echo ========================================
    ERROR: Push failed. Please check:
    echo 1. You have a Personal Access Token
    echo 2. The token has 'repo' permissions
    echo 3. You have write access to the repository
    echo ========================================
)

echo.
pause
