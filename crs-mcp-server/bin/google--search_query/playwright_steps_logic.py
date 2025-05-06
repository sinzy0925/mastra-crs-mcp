import re
from playwright.sync_api import Playwright, sync_playwright, expect


def run(playwright: Playwright) -> None:
    browser = playwright.chromium.launch(headless=False)
    context = browser.new_context()
    page = context.new_page()
    page.goto("https://www.google.com/")
    #page.get_by_role("combobox", name="検索").fill("大阪府　堺市　株式会社　お問い合わせ")
    page.get_by_role("combobox", name="検索").fill("{{search_query}}")
    page.get_by_role("combobox", name="検索").click()
    page.get_by_role("button", name="Google 検索").click()
    # ---------------------
    context.close()
    browser.close()


with sync_playwright() as playwright:
    run(playwright)
