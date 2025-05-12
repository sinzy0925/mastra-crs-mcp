import re
from playwright.sync_api import Playwright, sync_playwright, expect


def run(playwright: Playwright) -> None:
    browser = playwright.chromium.launch(headless=False)
    context = browser.new_context()
    page = context.new_page()
    page.goto("https://stand.fm/")
    page.get_by_role("link", name="新規登録・ログイン").click()
    page.get_by_role("textbox", name="メールアドレス").click()
    page.get_by_role("textbox", name="メールアドレス").fill("sinzy@veryglad.net")
    page.get_by_role("textbox", name="パスワード").click()
    page.get_by_role("textbox", name="パスワード").click()
    page.get_by_role("textbox", name="パスワード").fill("sinzy@stanDfm")
    page.locator("#root > div > div > div > div > div:nth-child(2) > div:nth-child(1) > div > div:nth-child(1) > div > div > div:nth-child(6) > div:nth-child(10) > a > div > div").click()
    page.get_by_role("link", name="クリエイティブ・テック").click()

    # ---------------------
    context.close()
    browser.close()


with sync_playwright() as playwright:
    run(playwright)
