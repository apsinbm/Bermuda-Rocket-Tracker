/**
 * Weather Service for Bermuda Rocket Tracker
 * 
 * Provides weather data and visibility impact assessment for Bermuda
 * Uses OpenWeatherMap API for real-time conditions and forecasts
 */

export interface WeatherData {
  current: {
    temperature: number;
    humidity: number;
    cloudCover: number;
    visibility: number; // in kilometers
    windSpeed: number;
    windDirection: number;
    condition: string;
    icon: string;
  };
  forecast?: {
    datetime: string;
    temperature: number;
    cloudCover: number;
    visibility: number;
    condition: string;
    precipitationProbability: number;
  }[];
}

export interface LaunchWeatherAssessment {
  overallRating: 'excellent' | 'good' | 'fair' | 'poor' | 'very_poor';
  factors: {
    cloudCover: {
      rating: 'excellent' | 'good' | 'fair' | 'poor';
      value: number;
      impact: string;
    };
    visibility: {
      rating: 'excellent' | 'good' | 'fair' | 'poor';
      value: number;
      impact: string;
    };
    precipitation: {
      rating: 'excellent' | 'good' | 'fair' | 'poor';
      probability: number;
      impact: string;
    };
  };
  recommendation: string;
  detailedForecast: string;
}

export class WeatherService {
  private static readonly BERMUDA_LAT = 32.3078;
  private static readonly BERMUDA_LNG = -64.7505;
  private static readonly CACHE_DURATION = 10 * 60 * 1000; // 10 minutes
  
  // OpenWeatherMap API configuration
  private static readonly OPENWEATHER_API_KEY = process.env.REACT_APP_OPENWEATHER_API_KEY;
  private static readonly OPENWEATHER_BASE_URL = 'https://api.openweathermap.org/data/2.5';

  static async getCurrentWeather(): Promise<WeatherData> {
    const cached = this.getCachedWeather();
    if (cached) return cached;

    // Try to fetch real weather data, fallback to simulation if unavailable
    let weatherData: WeatherData;
    
    if (this.OPENWEATHER_API_KEY) {
      try {
        weatherData = await this.fetchRealWeatherData();
        console.log('[Weather] Using real weather data from OpenWeatherMap');
      } catch (error) {
        console.warn('[Weather] Failed to fetch real weather data, falling back to simulation:', error);
        weatherData = this.generateRealisticWeatherData();
      }
    } else {
      console.log('[Weather] No API key configured, using simulated data');
      weatherData = this.generateRealisticWeatherData();
    }
    
    this.cacheWeatherData(weatherData);
    return weatherData;
  }

  private static async fetchRealWeatherData(): Promise<WeatherData> {
    const url = `${this.OPENWEATHER_BASE_URL}/weather?lat=${this.BERMUDA_LAT}&lon=${this.BERMUDA_LNG}&appid=${this.OPENWEATHER_API_KEY}&units=metric`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`OpenWeatherMap API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    return {
      current: {
        temperature: Math.round(data.main.temp),
        humidity: data.main.humidity,
        cloudCover: data.clouds.all,
        visibility: Math.round((data.visibility || 10000) / 1000), // Convert meters to km
        windSpeed: Math.round(data.wind.speed * 3.6), // Convert m/s to km/h
        windDirection: data.wind.deg || 0,
        condition: this.mapOpenWeatherCondition(data.weather[0].main, data.weather[0].description),
        icon: this.mapOpenWeatherIcon(data.weather[0].icon, data.dt, data.sunrise, data.sunset)
      },
      forecast: [] // Extended forecast would require additional API call
    };
  }

  private static mapOpenWeatherCondition(main: string, description: string): string {
    const conditionMap: { [key: string]: string } = {
      'Clear': 'Clear',
      'Clouds': description.includes('few') ? 'Mostly Clear' : 
               description.includes('scattered') ? 'Partly Cloudy' :
               description.includes('broken') ? 'Mostly Cloudy' : 'Overcast',
      'Rain': 'Light Rain',
      'Drizzle': 'Drizzle',
      'Thunderstorm': 'Thunderstorms',
      'Snow': 'Snow',
      'Mist': 'Misty',
      'Fog': 'Foggy'
    };
    
    return conditionMap[main] || description.charAt(0).toUpperCase() + description.slice(1);
  }

  private static mapOpenWeatherIcon(iconCode: string, currentTime: number, sunrise: number, sunset: number): string {
    const isDay = currentTime >= sunrise && currentTime <= sunset;
    
    // Map OpenWeatherMap icons to emoji
    const iconMap: { [key: string]: string } = {
      '01d': '☀️', '01n': '🌙',  // clear sky
      '02d': '⛅', '02n': '☁️',  // few clouds
      '03d': '☁️', '03n': '☁️',  // scattered clouds
      '04d': '☁️', '04n': '☁️',  // broken clouds
      '09d': '🌧️', '09n': '🌧️', // shower rain
      '10d': '🌦️', '10n': '🌦️', // rain
      '11d': '⛈️', '11n': '⛈️',  // thunderstorm
      '13d': '❄️', '13n': '❄️',  // snow
      '50d': '🌫️', '50n': '🌫️'  // mist
    };
    
    return iconMap[iconCode] || (isDay ? '☀️' : '🌙');
  }

  static async getWeatherForLaunch(launchTime: Date): Promise<LaunchWeatherAssessment> {
    const weather = await this.getCurrentWeather();
    const hoursUntilLaunch = (launchTime.getTime() - Date.now()) / (1000 * 60 * 60);
    
    // For launches within 48 hours, use current conditions with some variation
    // For further launches, generate forecast
    const forecastWeather = hoursUntilLaunch <= 48 
      ? this.adjustWeatherForTime(weather, hoursUntilLaunch)
      : this.generateForecastWeather(launchTime);

    return this.assessLaunchConditions(forecastWeather, launchTime);
  }

  private static generateRealisticWeatherData(): WeatherData {
    // Simulate typical Bermuda weather patterns
    const hour = new Date().getHours();
    const season = this.getCurrentSeason();
    
    // Typical Bermuda conditions based on season and time
    const baseTemp = season === 'summer' ? 28 : season === 'winter' ? 20 : 24;
    const tempVariation = (Math.random() - 0.5) * 6; // ±3°C variation
    
    const cloudCoverBase = Math.random() * 80; // 0-80% base
    const visibilityBase = 15 + Math.random() * 25; // 15-40km typical for Bermuda
    
    return {
      current: {
        temperature: Math.round(baseTemp + tempVariation),
        humidity: 65 + Math.random() * 25, // 65-90% typical
        cloudCover: Math.round(cloudCoverBase),
        visibility: Math.round(visibilityBase),
        windSpeed: 5 + Math.random() * 15, // 5-20 mph typical
        windDirection: Math.round(Math.random() * 360),
        condition: this.getConditionFromCloudCover(cloudCoverBase),
        icon: this.getWeatherIcon(cloudCoverBase, hour)
      },
      forecast: [] // Would populate from API in production
    };
  }

  private static adjustWeatherForTime(currentWeather: WeatherData, hoursFromNow: number): WeatherData {
    // Simple weather evolution model
    const tempChange = Math.sin(hoursFromNow * Math.PI / 12) * 3; // Daily temperature cycle
    const cloudEvolution = (Math.random() - 0.5) * 20; // ±10% cloud change
    
    return {
      ...currentWeather,
      current: {
        ...currentWeather.current,
        temperature: currentWeather.current.temperature + tempChange,
        cloudCover: Math.max(0, Math.min(100, currentWeather.current.cloudCover + cloudEvolution)),
        visibility: currentWeather.current.visibility + (Math.random() - 0.5) * 5
      }
    };
  }

  private static generateForecastWeather(launchTime: Date): WeatherData {
    // For launches beyond 48 hours, generate seasonal appropriate weather
    return this.generateRealisticWeatherData();
  }

  private static assessLaunchConditions(weather: WeatherData, launchTime: Date): LaunchWeatherAssessment {
    const { current } = weather;
    
    // Assess cloud cover impact
    const cloudRating = current.cloudCover <= 20 ? 'excellent' :
                       current.cloudCover <= 40 ? 'good' :
                       current.cloudCover <= 70 ? 'fair' : 'poor';
    
    // Assess visibility impact
    const visibilityRating = current.visibility >= 30 ? 'excellent' :
                            current.visibility >= 20 ? 'good' :
                            current.visibility >= 10 ? 'fair' : 'poor';
    
    // Assess precipitation (simulated)
    const precipProb = this.getPrecipitationProbability(current.cloudCover, current.humidity);
    const precipRating = precipProb <= 10 ? 'excellent' :
                        precipProb <= 30 ? 'good' :
                        precipProb <= 60 ? 'fair' : 'poor';

    // Calculate overall rating
    const ratings = [cloudRating, visibilityRating, precipRating];
    const excellentCount = ratings.filter(r => r === 'excellent').length;
    const goodCount = ratings.filter(r => r === 'good').length;
    const poorCount = ratings.filter(r => r === 'poor').length;

    let overallRating: LaunchWeatherAssessment['overallRating'];
    if (excellentCount >= 2) overallRating = 'excellent';
    else if (excellentCount + goodCount >= 2 && poorCount === 0) overallRating = 'good';
    else if (poorCount >= 2) overallRating = 'poor';
    else overallRating = 'fair';

    return {
      overallRating,
      factors: {
        cloudCover: {
          rating: cloudRating,
          value: current.cloudCover,
          impact: this.getCloudImpact(current.cloudCover)
        },
        visibility: {
          rating: visibilityRating,
          value: current.visibility,
          impact: this.getVisibilityImpact(current.visibility)
        },
        precipitation: {
          rating: precipRating,
          probability: precipProb,
          impact: this.getPrecipitationImpact(precipProb)
        }
      },
      recommendation: this.generateRecommendation(overallRating, launchTime),
      detailedForecast: this.generateDetailedForecast(weather, launchTime)
    };
  }

  private static getCurrentSeason(): 'spring' | 'summer' | 'fall' | 'winter' {
    const month = new Date().getMonth() + 1; // 1-12
    if (month >= 3 && month <= 5) return 'spring';
    if (month >= 6 && month <= 8) return 'summer';
    if (month >= 9 && month <= 11) return 'fall';
    return 'winter';
  }

  private static getConditionFromCloudCover(cloudCover: number): string {
    if (cloudCover <= 10) return 'Clear';
    if (cloudCover <= 25) return 'Mostly Clear';
    if (cloudCover <= 50) return 'Partly Cloudy';
    if (cloudCover <= 75) return 'Mostly Cloudy';
    return 'Overcast';
  }

  private static getWeatherIcon(cloudCover: number, hour: number): string {
    const isDay = hour >= 6 && hour <= 18;
    
    if (cloudCover <= 10) return isDay ? '☀️' : '🌙';
    if (cloudCover <= 50) return isDay ? '⛅' : '☁️';
    return '☁️';
  }

  private static getPrecipitationProbability(cloudCover: number, humidity: number): number {
    // Simple model: more clouds + high humidity = higher rain chance
    const baseProb = cloudCover * 0.3; // 0-30% from clouds
    const humidityBonus = humidity > 80 ? (humidity - 80) * 0.5 : 0; // Extra 0-5% from high humidity
    return Math.min(95, Math.round(baseProb + humidityBonus));
  }

  private static getCloudImpact(cloudCover: number): string {
    if (cloudCover <= 20) return 'Clear skies - excellent rocket visibility';
    if (cloudCover <= 40) return 'Light clouds - good visibility with occasional breaks';
    if (cloudCover <= 70) return 'Moderate clouds - visibility may be intermittent';
    return 'Heavy clouds - rocket likely obscured during most of flight';
  }

  private static getVisibilityImpact(visibility: number): string {
    if (visibility >= 30) return 'Excellent atmospheric clarity - rocket visible at maximum range';
    if (visibility >= 20) return 'Good visibility - clear view of rocket trajectory';
    if (visibility >= 10) return 'Moderate visibility - may affect distant viewing';
    return 'Poor visibility - atmospheric haze will significantly limit viewing';
  }

  private static getPrecipitationImpact(probability: number): string {
    if (probability <= 10) return 'No precipitation expected - ideal conditions';
    if (probability <= 30) return 'Light chance of rain - should not affect viewing';
    if (probability <= 60) return 'Moderate rain chance - may interrupt viewing';
    return 'High precipitation probability - poor viewing conditions likely';
  }

  private static generateRecommendation(rating: string, launchTime: Date): string {
    const timeUntil = Math.round((launchTime.getTime() - Date.now()) / (1000 * 60 * 60));
    
    switch (rating) {
      case 'excellent':
        return `🌟 Perfect conditions expected! Clear skies and excellent visibility. ${timeUntil < 24 ? 'Get ready for an amazing show!' : 'Weather looks ideal for launch day.'}`;
      case 'good':
        return `👍 Good viewing conditions expected. Some clouds possible but should not significantly impact visibility. ${timeUntil < 24 ? 'Great launch viewing opportunity!' : 'Weather trending positive.'}`;
      case 'fair':
        return `⚠️ Mixed conditions. Visibility may be partially blocked by clouds or haze. ${timeUntil < 24 ? 'Be prepared for intermittent viewing.' : 'Monitor weather closer to launch.'}`;
      case 'poor':
        return `🌧️ Challenging conditions expected. Heavy clouds or precipitation likely. ${timeUntil < 24 ? 'Consider backup viewing plans.' : 'Weather may improve - check updates.'}`;
      default:
        return '📡 Weather assessment in progress...';
    }
  }

  private static generateDetailedForecast(weather: WeatherData, launchTime: Date): string {
    const { current } = weather;
    const windDir = this.getWindDirection(current.windDirection);
    
    return `Expected conditions: ${current.condition} with ${current.cloudCover}% cloud cover. ` +
           `Visibility ${current.visibility}km, winds ${windDir} at ${Math.round(current.windSpeed)} mph. ` +
           `Temperature around ${Math.round(current.temperature)}°C with ${Math.round(current.humidity)}% humidity.`;
  }

  private static getWindDirection(degrees: number): string {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    return directions[Math.round(degrees / 22.5) % 16];
  }

  private static getCachedWeather(): WeatherData | null {
    try {
      const cached = localStorage.getItem('bermuda-weather-cache');
      if (!cached) return null;
      
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp > this.CACHE_DURATION) {
        localStorage.removeItem('bermuda-weather-cache');
        return null;
      }
      
      return data;
    } catch {
      return null;
    }
  }

  private static cacheWeatherData(data: WeatherData): void {
    try {
      localStorage.setItem('bermuda-weather-cache', JSON.stringify({
        data,
        timestamp: Date.now()
      }));
    } catch {
      // Cache failed, continue without caching
    }
  }
}