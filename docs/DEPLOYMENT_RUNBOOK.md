# Bermuda Rocket Tracker - Deployment Runbook

## Quick Start Deployment

### Immediate Production Deployment
```bash
# 1. Pre-flight checks
npm run pre-deploy

# 2. Deploy to Vercel (Recommended)
vercel --prod

# 3. Verify deployment
curl -f https://bermuda-rocket-tracker.vercel.app
```

## Environment Setup

### Required Secrets (GitHub/Vercel)
```bash
# Vercel
VERCEL_TOKEN=your_vercel_token
VERCEL_ORG_ID=your_org_id  
VERCEL_PROJECT_ID=your_project_id

# OpenWeather API
REACT_APP_OPENWEATHER_API_KEY=your_openweather_key
```

### Development Environment
```bash
git clone [repository]
cd bermuda-rocket-tracker
npm install
npm start  # http://localhost:3000
```

### Production Environment  
```bash
npm run build
node all-interfaces-server.js  # http://0.0.0.0:8080
```

## Deployment Procedures

### Standard Release Process
1. **Development Phase**
   - Create feature branch: `git checkout -b feature/your-feature`
   - Implement changes with tests
   - Run: `npm run pre-deploy`

2. **Review Phase**
   - Create pull request to `main`
   - Automated staging deployment triggered
   - Manual QA review on staging URL
   - Code review and approval

3. **Production Release**
   - Merge to `main` branch
   - Automated production deployment
   - Monitor health checks for 30 minutes
   - Validate key functionality

### Hotfix Deployment
```bash
# 1. Create hotfix branch
git checkout -b hotfix/critical-fix main

# 2. Apply minimal fix
# ... make changes ...

# 3. Fast-track deployment
npm run pre-deploy
git push origin hotfix/critical-fix

# 4. Emergency merge and deploy
git checkout main
git merge hotfix/critical-fix
git push origin main
```

## Monitoring & Validation

### Health Check Endpoints
- **Application**: https://bermuda-rocket-tracker.vercel.app
- **Health Status**: Check browser console for errors
- **API Status**: Monitor Space Devs API responses in Network tab

### Key Performance Metrics
- **Load Time**: < 3 seconds initial load
- **Bundle Size**: < 100KB gzipped main bundle  
- **API Response**: < 2 seconds for launch data
- **Error Rate**: < 1% of requests

### Post-Deployment Checklist
- [ ] Application loads without errors
- [ ] Launch data displays correctly  
- [ ] Trajectory visualizations render
- [ ] Notifications work properly
- [ ] Dark/light mode toggle functions
- [ ] Mobile responsiveness verified
- [ ] API rate limiting respected

## Troubleshooting

### Common Issues

**No Launch Data Showing**
```bash
# Check browser console for API errors
# Clear cache: localStorage.clear()
# Verify API endpoint: curl https://ll.thespacedevs.com/2.2.0/launch/upcoming/
```

**Build Failures**
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

**Deployment Timeouts**
```bash
# Check bundle size
npm run build:analyze

# Optimize if needed
npm run build -- --verbose
```

**API Rate Limiting**
```bash
# Check localStorage for cached data
# Monitor API call frequency in Network tab
# Verify intelligent caching is working
```

### Emergency Procedures

**Production Down**
1. Check Vercel status page
2. Run health check manually: `curl -I https://bermuda-rocket-tracker.vercel.app`
3. If needed: `./scripts/rollback.sh [previous-deployment]`

**Data Issues**  
1. Check Space Devs API status
2. Verify cached data in localStorage
3. Force refresh: Clear cache button in app
4. If persistent: Deploy with API fallback

**Performance Degradation**
1. Check Vercel analytics
2. Monitor bundle size
3. Review recent commits for performance regressions
4. Consider rollback if severe

## Architecture Notes

### Current Stack
- **Frontend**: React 18 + TypeScript
- **Styling**: Tailwind CSS
- **Deployment**: Vercel with CDN
- **Data**: The Space Devs Launch Library API
- **Caching**: Browser localStorage + intelligent refresh

### Service Dependencies
- **Critical**: Space Devs Launch Library API
- **Optional**: OpenWeather API (fallback to mock data)
- **Infrastructure**: Vercel hosting platform

### Data Flow
1. App checks localStorage cache
2. If stale, fetches from Space Devs API
3. Processes launch data for Bermuda visibility
4. Updates cache with intelligent refresh schedule
5. Renders UI with trajectory visualizations

## Maintenance

### Regular Tasks
- **Weekly**: Review error logs and performance metrics
- **Monthly**: Update dependencies (`npm audit` and `npm update`)
- **Quarterly**: Review and optimize bundle size
- **Annually**: Review API rate limits and usage patterns

### Dependency Updates
```bash
# Check for updates
npm outdated

# Update non-breaking changes
npm update

# Update major versions carefully
npm install react@latest react-dom@latest
npm run test
npm run build
```

### Performance Optimization
```bash
# Analyze bundle
npm run build:analyze

# Check for unused code
npx webpack-bundle-analyzer build/static/js/*.js
```

## Contact & Support

**Development Team**: Patrick (Primary Developer)
**Infrastructure**: Vercel deployment platform
**APIs**: The Space Devs (launch data), OpenWeatherMap (weather)

**Emergency Contact**: Check GitHub issues for urgent problems
**Documentation**: This runbook + `/docs` directory
**Monitoring**: GitHub Actions workflows + manual health checks