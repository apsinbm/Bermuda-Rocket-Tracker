# Bermuda Rocket Tracker - Deployment Guide

## Prerequisites

1. **GitHub Account**: Ensure your code is in a GitHub repository
2. **Vercel Account**: Sign up at [vercel.com](https://vercel.com) using your GitHub account
3. **Domain** (optional): Purchase a custom domain if desired
4. **OpenWeatherMap API Key**: Get free API key from [openweathermap.org](https://openweathermap.org/api)

## Step-by-Step Deployment

### Phase 1: Prepare Repository

1. **Commit all changes to GitHub**:
   ```bash
   git add .
   git commit -m "feat: prepare for production deployment"
   git push origin main
   ```

2. **Verify build works locally**:
   ```bash
   npm run build
   ```
   Ensure no critical errors in build output.

### Phase 2: Set up Vercel Project

1. **Import Project to Vercel**:
   - Go to [vercel.com/dashboard](https://vercel.com/dashboard)
   - Click "New Project"
   - Import your GitHub repository
   - Select "bermuda-rocket-tracker"

2. **Configure Build Settings**:
   - Framework Preset: `Create React App`
   - Build Command: `npm run build`
   - Output Directory: `build`
   - Install Command: `npm ci`

3. **Set Environment Variables**:
   In Vercel dashboard → Project → Settings → Environment Variables:
   ```
   REACT_APP_OPENWEATHER_API_KEY=your_api_key_here
   GENERATE_SOURCEMAP=false
   REACT_APP_ENV=production
   ```

### Phase 3: Configure GitHub Actions

1. **Get Vercel Secrets**:
   ```bash
   npx vercel --confirm
   npx vercel link
   ```
   
   This creates `.vercel/project.json` with your project details.

2. **Add GitHub Secrets**:
   Go to GitHub repo → Settings → Secrets and Variables → Actions
   
   Add these secrets:
   ```
   VERCEL_TOKEN=your_vercel_token
   VERCEL_ORG_ID=your_org_id
   VERCEL_PROJECT_ID=your_project_id
   REACT_APP_OPENWEATHER_API_KEY=your_openweather_api_key
   ```

3. **Deploy via GitHub Actions**:
   Push to main branch to trigger automatic deployment.

### Phase 4: Custom Domain (Optional)

1. **Add Domain in Vercel**:
   - Project Settings → Domains
   - Add your custom domain
   - Follow DNS configuration instructions

2. **DNS Configuration**:
   Add these records to your domain DNS:
   ```
   Type: A     Name: @     Value: 76.76.19.61
   Type: AAAA  Name: @     Value: 2600:1f13:e24:300::2
   Type: CNAME Name: www   Value: cname.vercel-dns.com
   ```

### Phase 5: Performance Optimization

1. **Enable Analytics**:
   - Vercel Dashboard → Project → Analytics
   - Enable Web Vitals monitoring

2. **Configure Cache Headers**:
   Already configured in `vercel.json`

3. **Monitor Performance**:
   - Check Vercel Analytics dashboard
   - Monitor Core Web Vitals
   - Use Lighthouse for performance audits

## Post-Deployment Verification

### Health Check Checklist

- [ ] Application loads successfully
- [ ] Launch data displays correctly
- [ ] API calls work (check Network tab)
- [ ] Trajectory visualizations render
- [ ] Responsive design works on mobile
- [ ] PWA features function (if enabled)
- [ ] Performance metrics are good (Lighthouse score >90)
- [ ] Error monitoring is active

### Performance Targets

- **First Contentful Paint**: < 1.5s
- **Largest Contentful Paint**: < 2.5s
- **Cumulative Layout Shift**: < 0.1
- **First Input Delay**: < 100ms
- **Bundle Size**: < 100KB gzipped (current: 96.56KB)

## Monitoring and Maintenance

### Daily Monitoring
- Check Vercel dashboard for errors
- Monitor API rate limits
- Verify launch data is updating

### Weekly Maintenance
- Review performance metrics
- Check for dependency updates
- Monitor user feedback

### Monthly Tasks
- Security updates
- Performance optimization review
- Feature usage analysis

## Troubleshooting

### Common Issues

1. **Build Failures**:
   ```bash
   npm run build
   ```
   Fix TypeScript errors and warnings.

2. **Environment Variables Not Working**:
   - Verify variables are set in Vercel dashboard
   - Check variable names match exactly
   - Redeploy after adding variables

3. **API Rate Limiting**:
   - Implement caching (already done)
   - Consider upgrading API plan if needed
   - Add retry logic with exponential backoff

4. **Performance Issues**:
   - Run `npm run build:analyze`
   - Check bundle size and optimize imports
   - Implement lazy loading for large components

### Support Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Create React App Deployment](https://create-react-app.dev/docs/deployment/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)

## Rollback Procedures

### Immediate Rollback
1. Go to Vercel Dashboard → Deployments
2. Find last working deployment
3. Click "Promote to Production"

### Code Rollback
```bash
git revert HEAD
git push origin main
```

### Environment Variable Rollback
1. Vercel Dashboard → Settings → Environment Variables
2. Edit variables to previous values
3. Redeploy

## Security Considerations

- API keys stored securely in environment variables
- HTTPS enforced automatically
- Security headers configured in `vercel.json`
- No sensitive data in client-side code
- Regular dependency updates for security patches

## Cost Optimization

### Free Tier Limits (Vercel)
- 100GB bandwidth per month
- Unlimited deployments
- 6,000 build minutes per month
- 1 concurrent build

### Upgrade Triggers
- Exceeding bandwidth limits
- Need for more build minutes
- Advanced analytics requirements
- Team collaboration features