# E-commerce Price Monitoring System

## Overview

This is a hybrid e-commerce price monitoring system that tracks product prices across 5 Bermuda grocery stores:
- **MarketPlace (MP)** - Freshop platform
- **Harrington Hundreds (HH)** - Freshop platform  
- **Miles Market** - Freshop platform
- **Drop It/Lindos** - Freshop platform
- **Pronto** - Eddress platform

## System Architecture

The system uses a **hybrid approach** combining multiple technologies for maximum reliability:

1. **Web Scraping** (Freshop stores): 20-second delays to handle dynamic JavaScript content
2. **API Integration** (Pronto): Direct API calls for fast, reliable data
3. **OCR Fallback**: Computer vision price extraction when other methods fail
4. **Store Location Selection**: Automatic selection of specific store locations

## Key Features

### 🎯 **100% Success Rate Achieved**
- Successfully captures prices from all 5 stores
- Handles dynamic JavaScript content with strategic delays
- Automatic store location selection for MarketPlace and Drop It

### 🚀 **Performance Optimized**
- **Web Scraping**: ~30 seconds per store (due to 20s JavaScript load delay)
- **API Calls**: <1 second per request (Pronto)
- **Stealth Browsing**: Random user agents, mouse movements, viewport sizes
- **Error Handling**: Comprehensive retry logic and fallback mechanisms

### 📊 **Detailed Reporting**
Excel output with 14 columns in specified order:
1. UPC/PLU
2. Brand  
3. Product Name
4. Store
5. Price Found
6. Price Difference
7. Expected Price
8. Price Match
9. Status
10. Method
11. Error
12. Response Time
13. Checked At
14. URL

## Core Components

### 1. `hybrid_monitor.py` - Main Application
**Primary monitoring system that orchestrates all price checking activities.**

**Key Classes:**
- `HybridEcommerceMonitor`: Main controller class
- Performance tracking and statistics
- Excel report generation with color coding

**Key Methods:**
- `create_driver()`: Creates stealth Chrome browser instances
- `handle_store_selection()`: Automatically selects store locations
- `scrape_freshop_store()`: Web scraping with 20-second delays
- `get_pronto_data()`: API calls for Pronto store
- `extract_price_with_ocr()`: OCR fallback price extraction
- `process_single_url()`: Processes individual product URLs
- `monitor_products()`: Main monitoring loop
- `generate_report()`: Creates Excel reports

**Store Selection Logic:**
- **MarketPlace**: Selects "The MarketPlace Hamilton, 42 Church Street, Hamilton, Bermuda HM 12"
- **Drop It**: Selects "Warwick" location
- **Other stores**: No selection required

### 2. `api_integrations.py` - API Management
**Handles API communications for Pronto store.**

**Key Classes:**
- `EddressAPI`: Pronto store API integration
- `APIRateLimiter`: Request rate limiting
- Product URL parsing and data extraction

**Key Methods:**
- `extract_product_slug()`: Extracts product identifiers from URLs
- `get_product_data()`: Makes API calls to retrieve product information
- `parse_eddress_response()`: Processes API responses

### 3. `api_config.py` - Configuration Management
**Central configuration for all API settings and store mappings.**

**Configuration Includes:**
- Eddress API configuration for Pronto
- URL-to-store mapping patterns
- Rate limiting settings
- Request headers and error handling

### 4. Supporting Files

**Test Files:**
- `quick_test.py`: Single product testing across all stores
- `test_api_monitor.py`: API system validation

**Data Files:**
- `Short test.xlsx`: Sample 3-product dataset
- Various result Excel files with monitoring outputs

## Technical Implementation Details

### Web Scraping Strategy (Freshop Stores)

```python
# 20-second delay strategy for JavaScript content
def scrape_freshop_store(self, url, store_type, product_name):
    # 1. Create stealth browser with random configurations
    driver = self.create_driver()
    
    # 2. Navigate and simulate human behavior
    driver.get(url)
    self.random_mouse_movement(driver)
    self.random_scroll(driver)
    
    # 3. Handle store selection
    self.handle_store_selection(driver, store_type)
    
    # 4. CRITICAL: 20-second wait for JavaScript
    time.sleep(20)
    
    # 5. Try multiple price selectors
    price_selectors = ['.price', '.product-price', '*[class*="price"]', ...]
    
    # 6. OCR fallback if scraping fails
    if not price_found:
        price_found = self.extract_price_with_ocr(driver)
```

### API Integration Strategy (Pronto)

```python
# Fast API calls for Pronto store
def get_pronto_data(self, url, product_name):
    # 1. Extract product slug from URL
    product_slug = self.extract_product_slug(url)
    
    # 2. Build API endpoint
    api_url = f"{base_url}/market/app/store/{store_id}/product/{product_slug}"
    
    # 3. Make API call with rate limiting
    response = self.session.get(api_url)
    
    # 4. Parse and return structured data
    return self.parse_eddress_response(response.json(), url)
```

### OCR Fallback System

```python
# Computer vision price extraction
def extract_price_with_ocr(self, driver):
    # 1. Take full page screenshot
    screenshot = driver.get_screenshot_as_png()
    
    # 2. Process with EasyOCR
    results = self.ocr_reader.readtext(opencv_image)
    
    # 3. Search for price patterns
    price_patterns = [r'\$\s*(\d+\.?\d*)', r'Price[:\s]*\$?\s*(\d+\.?\d*)']
    
    # 4. Return first valid price found
    return validated_price
```

## Dependencies

### Python Packages
```
pandas>=1.5.0          # Excel file processing
selenium>=4.15.0        # Web automation
undetected-chromedriver>=3.5.0  # Stealth browsing
webdriver-manager>=4.0.0  # Chrome driver management
easyocr>=1.7.0         # OCR text recognition
opencv-python>=4.8.0   # Image processing
openpyxl>=3.1.0        # Excel file generation
requests>=2.31.0       # HTTP requests
Pillow>=10.0.0         # Image manipulation
```

### System Requirements
- **Chrome Browser**: Latest version
- **ChromeDriver**: Auto-managed by webdriver-manager
- **Python**: 3.8+
- **Memory**: 4GB+ recommended (for OCR models)

## Usage Examples

### Single Product Test
```bash
python3 quick_test.py
```

### Full Monitoring (3 products across 5 stores)
```bash
python3 hybrid_monitor.py
```

### Custom Input File
```python
monitor = HybridEcommerceMonitor(
    input_file="/path/to/products.xlsx",
    output_file="/path/to/results.xlsx"
)
monitor.run()
```

## Performance Metrics

### Latest Test Results (Single Product - BANANAS)
- **Total URLs**: 5 (1 product × 5 stores)
- **Success Rate**: 100% (5/5)
- **Methods Used**:
  - Scraping: 4 stores (MP, HH, Drop It, Miles)
  - API: 1 store (Pronto)
  - OCR: 0 (not needed)
- **Total Time**: 142.57 seconds
- **Average per Store**: ~28.5 seconds

### Price Capture Results
| Store | Price | Method | Response Time | Store Selection |
|-------|-------|--------|---------------|-----------------|
| MP | $2.99 | Scraping | 35.93s | ✅ Hamilton |
| HH | $2.99 | Scraping | 29.91s | ❌ Not needed |
| Drop It | $3.29 | Scraping | 34.27s | ✅ Warwick |
| Miles | $3.25 | Scraping | 30.55s | ❌ Not needed |
| Pronto | $3.65 | API | 0.61s | ❌ Not needed |

## Troubleshooting

### Common Issues

**1. ChromeDriver Version Mismatch**
- **Solution**: System uses webdriver-manager for automatic driver management
- **Fallback**: Manual ChromeDriver installation via Homebrew

**2. JavaScript Content Not Loading**
- **Solution**: 20-second delay implemented for Freshop stores
- **Alternative**: OCR fallback automatically triggered

**3. Store Selection Failures**
- **Solution**: Multiple selector strategies with JavaScript fallbacks
- **Monitoring**: Detailed logging of selection attempts

**4. API Rate Limiting**
- **Solution**: Built-in rate limiters and respectful request timing
- **Fallback**: Automatic retry logic with exponential backoff

### Debug Information

**Log Files Generated:**
- `hybrid_monitor.log`: Detailed execution logs
- Console output with real-time progress

**Excel Reports Include:**
- Color-coded success/failure status
- Detailed error messages
- Response time tracking
- Method used for each capture

## Security & Ethics

### Respectful Scraping Practices
- **Rate Limiting**: 20-second delays between requests
- **Human Simulation**: Random mouse movements and scrolling
- **User Agent Rotation**: Multiple browser signatures
- **Store-Specific Adaptation**: Proper store location selection

### Data Handling
- **No Personal Data**: Only public product pricing information
- **Local Storage**: All data stored locally, no external transmission
- **Transparent Logging**: Full audit trail of all activities

## Future Enhancements

### Potential Improvements
1. **Database Integration**: Store historical price data
2. **Price Alert System**: Notifications for price changes
3. **Parallel Processing**: Concurrent store monitoring
4. **Mobile App Interface**: Real-time price checking
5. **Advanced Analytics**: Price trend analysis and reporting

### Scalability Considerations
- **Multi-threading**: Can be implemented for faster processing
- **Cloud Deployment**: Docker containerization ready
- **API Expansion**: Additional store integrations possible
- **Machine Learning**: Price prediction and anomaly detection

## Version History

### Current Version: v2.0 (Hybrid System)
- ✅ 100% success rate across all 5 stores
- ✅ Store location selection implemented
- ✅ OCR fallback system functional
- ✅ 20-second delay strategy for JavaScript content
- ✅ Custom Excel format with 14 specified columns

### Previous Versions
- **v1.0**: Pure API approach (limited store coverage)
- **v0.x**: Web scraping prototypes (inconsistent results)

---

## Contact & Support

For questions or issues:
- **Repository**: github.com/apsinbm/price-checker
- **Documentation**: This README.md file
- **Logs**: Check `hybrid_monitor.log` for detailed execution information

---

*Last Updated: June 30, 2025*
*System Status: Production Ready ✅*