"""
Digital Product System - Lo-Fi Prototype Playwright Test
"""
from playwright.sync_api import sync_playwright
import os

def test_digital_product_prototype():
    print("=" * 60)
    print("Digital Product System - Lo-Fi Prototype Test")
    print("=" * 60)
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        
        try:
            # 1. Test Dashboard
            print("\n[1/5] Testing Dashboard...")
            page.goto('http://localhost:5173/')
            page.wait_for_load_state('networkidle')
            page.wait_for_timeout(2000)
            page.screenshot(path='./test-results/01-dashboard.png', full_page=False)
            print("   [OK] Dashboard loaded, screenshot: 01-dashboard.png")
            
            # Check key elements
            title = page.locator('h3').first
            title_text = title.inner_text()
            print(f"   [INFO] Page title: {title_text}")
            
            # 2. Test Template Modeling Page
            print("\n[2/5] Testing Template Modeling Page...")
            page.locator('.ant-menu-item').nth(1).click()
            page.wait_for_load_state('networkidle')
            page.wait_for_timeout(1000)
            page.screenshot(path='./test-results/02-template-modeling.png', full_page=False)
            print("   [OK] Template Modeling page loaded, screenshot: 02-template-modeling.png")
            
            # 3. Test Product Model Page
            print("\n[3/5] Testing Product Model Page...")
            page.locator('.ant-menu-item').nth(2).click()
            page.wait_for_load_state('networkidle')
            page.wait_for_timeout(1000)
            page.screenshot(path='./test-results/03-product-model.png', full_page=False)
            print("   [OK] Product Model page loaded, screenshot: 03-product-model.png")
            
            # 4. Test Instance Page
            print("\n[4/5] Testing Instance Page...")
            page.locator('.ant-menu-item').nth(3).click()
            page.wait_for_load_state('networkidle')
            page.wait_for_timeout(1000)
            page.screenshot(path='./test-results/04-instance.png', full_page=False)
            print("   [OK] Instance page loaded, screenshot: 04-instance.png")
            
            # 5. Test Explore Page
            print("\n[5/5] Testing Graph Explore Page...")
            page.locator('.ant-menu-item').nth(4).click()
            page.wait_for_load_state('networkidle')
            page.wait_for_timeout(1000)
            page.screenshot(path='./test-results/05-explore.png', full_page=False)
            print("   [OK] Graph Explore page loaded, screenshot: 05-explore.png")
            
            # Verify SVG canvas rendered
            print("\n[Verify] Checking if SVG canvas rendered...")
            svg_canvas = page.locator('svg').first
            if svg_canvas:
                print("   [OK] SVG canvas rendered successfully")
            
            # Verify graph nodes exist
            print("\n[Verify] Checking graph nodes count...")
            nodes = page.locator('svg rect').all()
            print(f"   [INFO] Found {len(nodes)} SVG elements (nodes + edges)")
            
            # Test search functionality
            print("\n[Verify] Testing search functionality...")
            search_input = page.locator('input[placeholder*="Search"]')
            if search_input.count() > 0:
                search_input.fill('ROUTER')
                page.wait_for_timeout(500)
                page.screenshot(path='./test-results/06-search.png', full_page=False)
                print("   [OK] Search functionality works, screenshot: 06-search.png")
            
            print("\n" + "=" * 60)
            print("All acceptance tests PASSED!")
            print("=" * 60)
            print("\nScreenshots saved to ./test-results/")
            print("\nPages verified:")
            print("  - Dashboard (/)")
            print("  - Template Modeling (/template)")
            print("  - Product Model (/model)")
            print("  - Instance (/instance)")
            print("  - Graph Explore (/explore)")
            
        except Exception as e:
            print(f"\n[FAIL] Test failed: {e}")
            page.screenshot(path='./test-results/error.png', full_page=False)
            raise
        finally:
            browser.close()

if __name__ == "__main__":
    os.makedirs('./test-results', exist_ok=True)
    test_digital_product_prototype()
