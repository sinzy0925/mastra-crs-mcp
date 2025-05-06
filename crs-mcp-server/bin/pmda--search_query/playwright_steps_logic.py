import re
from playwright.sync_api import Playwright, sync_playwright, expect


def run(playwright: Playwright) -> None:
    browser = playwright.chromium.launch(headless=False)
    context = browser.new_context()
    page = context.new_page()
    page.goto("https://www.pmda.go.jp/PmdaSearch/iyakuSearch/")
    page.locator("#txtName").click()
    page.locator("#txtName").fill("{{search_query}}")
    with page.expect_popup() as page1_info:
        page.get_by_role("button", name="Submit").first.click()
    page1 = page1_info.value
    with page1.expect_popup() as page2_info:
        page1.get_by_role("link", name="HTML").first.click()
    page2 = page2_info.value

    # ---------------------
    context.close()
    browser.close()


with sync_playwright() as playwright:
    run(playwright)
