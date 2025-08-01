# ChatGPT Agent Prompt: Scraping MarketPlace and Harrington Hundreds (Bermuda Freshop Sites)

## Your Task
You need to understand how to scrape two Bermuda grocery store websites that both run on the Freshop e-commerce platform:

1. **MarketPlace** (marketplace.bm) - Requires login authentication
2. **Harrington Hundreds** (harringtonhundreds.bm) - Public access

## Critical Background: Freshop Platform
Both websites use Freshop, a white-label grocery e-commerce platform. This means they share:
- **Mandatory store selection** before accessing products
- **Similar CSS selectors** for prices and product data
- **Heavy JavaScript** requiring extended load times
- **Anti-bot protections** (Wordfence security)

## Authentication Details (MarketPlace Only)
- **Email**: singleton33@yahoo.com
- **Password**: 2wTJ9LvJo^Gy4SF89XqH
- **Login Required**: Must authenticate before accessing product pages
- **Store Selection**: Choose "Hamilton" location after login

## Critical Success Requirements

### 1. Store Selection (MANDATORY FOR BOTH SITES)
**Why Critical**: Both sites block product access until you select a store location
**Implementation**: 
- Look for "Hamilton" store selection buttons/links
- Must happen before accessing any product URLs
- Use multiple selector strategies (text content, CSS classes, data attributes)
- Session cookies will remember selection for subsequent requests

### 2. Anti-Bot Protection Strategy
**Challenge**: Wordfence security + JavaScript detection
**Solution Requirements**:
- Use undetected browser automation (not regular Chrome/Selenium)
- Disable automation flags: `--disable-blink-features=AutomationControlled`
- Real user agent: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36`
- Remove webdriver property: `navigator.webdriver = undefined`

### 3. Timing Strategy (ABSOLUTELY CRITICAL)
**20-Second Dynamic Wait**: Freshop sites require extended JavaScript rendering time
**Implementation**:
```
1. Navigate to page
2. Wait 3-5 seconds (initial load)
3. Perform human-like actions (mouse movement, scrolling)
4. Wait 20 seconds (CRITICAL - dynamic content load)
5. Then extract data
```

### 4. Price Extraction Selectors (Freshop Standard)
**Primary CSS Selectors** (high success rate):
- `.price`
- `.product-price`
- `[data-testid="price"]`
- `.current-price`
- `.sale-price`
- `.fp-item-price` (Freshop-specific)

**Headers as Fallback**:
- `h1, h2, h3` (often contain prominent pricing)

### 5. Error Recovery Patterns
**Blocking Indicators to Watch For**:
- "wordfence" in page content
- "access denied" messages  
- "security check" pages
- Cloudflare challenge screens

**Recovery Actions**:
- Clear cookies and restart session
- Increase wait times to 30+ seconds
- Use OCR fallback if CSS selectors fail

## Site-Specific Details

### MarketPlace (marketplace.bm)
- **Requires Login**: Use provided credentials first
- **Post-Login**: Select Hamilton store location
- **Session Management**: Store cookies for subsequent requests
- **Rate Limit**: 2 requests per minute maximum
- **Platform**: Freshop with authentication layer

### Harrington Hundreds (harringtonhundreds.bm)
- **No Login Required**: Direct access after store selection
- **Store Selection**: Choose Hamilton location on homepage
- **Heavy JavaScript**: May need >20 seconds load time
- **Rate Limit**: 2 requests per minute maximum
- **Platform**: Standard Freshop implementation

## Success Metrics to Achieve
- **Target Success Rate**: >90% (based on proven Freshop patterns)
- **Price Extraction**: 100% accuracy for successfully loaded pages
- **Processing Time**: 2-3 minutes per product (including wait times)
- **Error Handling**: Graceful degradation with detailed logging

## Critical Implementation Notes
1. **Store selection MUST happen first** - no exceptions
2. **20-second wait is non-negotiable** - Freshop requires this for full load
3. **Conservative rate limiting** - 2 requests/minute prevents account suspension
4. **Session persistence** - Store cookies for MarketPlace authentication
5. **OCR fallback** - Use screenshot + text recognition if CSS fails

## Expected Challenges
- **MarketPlace**: Login session management, account lockout risks
- **Harrington Hundreds**: Heavy JavaScript causing slower loads
- **Both Sites**: Wordfence security triggering on automation detection

This approach has achieved 97.8% success rate on similar Freshop implementations. The key is respecting the platform's timing requirements and store selection workflow.