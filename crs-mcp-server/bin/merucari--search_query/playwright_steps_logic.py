import re
from playwright.sync_api import Playwright, sync_playwright, expect


def run(playwright: Playwright) -> None:
    browser = playwright.chromium.launch(headless=False)
    context = browser.new_context()
    page = context.new_page()
    page.goto("https://jp.mercari.com/search?keyword={{search_query}}&sort=num_likes&order=desc")
    #page.goto("{{search_query}}")
    page.locator("body").press("PageDown")
    page.wait_for_timeout(500)

    # ---------------------
    context.close()
    browser.close()


with sync_playwright() as playwright:
    run(playwright)
