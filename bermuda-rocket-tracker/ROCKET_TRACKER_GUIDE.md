# Bermuda Rocket Tracker - Complete Guide

## Overview

The Bermuda Rocket Tracker is a web application that helps people in Bermuda spot and track rocket launches from Florida's Space Coast. The app provides real-time launch schedules, visibility predictions, and precise viewing directions for optimal rocket spotting.

## How It Works

### 🚀 Launch Data Sources
- **Launch Library 2 API**: Provides comprehensive launch schedules, mission details, and launch pad information
- **Flight Club Integration**: Real trajectory data and maps when available
- **Space Launch Schedule**: Additional trajectory visualization support

### 🌍 Geographic Foundation
- **Bermuda Location**: 32.3078°N, 64.7505°W
- **Florida Launch Sites**: ~900 miles southwest of Bermuda
- **Key Insight**: Rockets launch FROM Florida (southwest) and travel in various easterly directions

### 📡 Trajectory Classification System

The app classifies rocket trajectories into 5 main directions based on orbit type:

#### 1. **Northeast Trajectories** 🧭
- **Examples**: ISS missions, Crew Dragon, Cygnus cargo
- **Why Northeast**: 51.6° orbital inclination to match International Space Station
- **Viewing**: Look **Southwest** initially, track as rocket passes overhead to northeast

#### 2. **East-Northeast Trajectories** 🧭
- **Examples**: Mid-inclination satellites (40-50° inclination)
- **Why ENE**: Moderate inclination orbits
- **Viewing**: Look **West-Southwest** initially, track as rocket curves northeast

#### 3. **East Trajectories** 🧭
- **Examples**: Equatorial satellites, low-inclination LEO missions
- **Why East**: Low inclination orbits (0-30° inclination)
- **Viewing**: Look **West** initially, track overhead as rocket passes east

**IMPORTANT NOTE**: Starlink missions use 53°+ inclination orbits, making them **Northeast** trajectories, NOT East trajectories despite being labeled "Low Earth Orbit".

#### 4. **East-Southeast Trajectories** 🧭
- **Examples**: Commercial satellites to unique orbits
- **Why ESE**: Specific orbital requirements
- **Viewing**: Look **West-Southwest** initially, track as rocket curves southeast

#### 5. **Southeast Trajectories** 🧭
- **Examples**: GTO (Geostationary Transfer Orbit), commercial satellites
- **Why Southeast**: Higher energy orbits, geostationary satellites
- **Viewing**: Look **West-Southwest** initially, track as rocket passes southeast

### 🎯 Viewing Direction Logic

**Critical Understanding**: Since rockets launch FROM Florida (which is southwest of Bermuda) and travel in various easterly directions, viewers must look in the OPPOSITE direction initially to see the rocket coming.

#### For Southeast Trajectories (Most Common):
1. **T+6 min**: Look **West-Southwest** (247°) - rocket appears as bright dot
2. **T+7 min**: Track **Southwest** - rocket climbing and getting brighter  
3. **T+8 min**: Track **South** - rocket at highest visibility
4. **T+9 min**: Track **Southeast** - rocket fading as it moves away

#### For East Trajectories:
1. **T+6 min**: Look **West** (270°) - rocket appears low on horizon
2. **T+7 min**: Track **Overhead** - rocket passes directly above
3. **T+8 min**: Track **East** - rocket moving away

#### For Northeast Trajectories:
1. **T+6 min**: Look **Southwest** (225°) - rocket appears distant
2. **T+7 min**: Track **West** then **West-Northwest** - rocket climbing
3. **T+8 min**: Track **North** - rocket at peak visibility  
4. **T+9 min**: Track **Northeast** - rocket fading

### 🌙 Visibility Factors

#### **Night Launches (High Visibility)**
- **Best Time**: 6 PM - 6 AM local time
- **Appearance**: Bright moving star with potential exhaust plume
- **Duration**: Typically visible for 3-4 minutes (T+6 to T+9)
- **Brightness**: Can be brighter than Venus at peak

#### **Day Launches (Limited Visibility)**
- **Challenge**: Blue sky makes rockets very difficult to spot
- **Possible Signs**: Contrail, very bright speck
- **Success Rate**: Much lower than night launches

### 🔬 Physics Behind Visibility

#### **Line of Sight Calculation**
- **Formula**: cos θ = R/(R+h) where R = Earth radius (6,371km), h = altitude
- **Falcon 9 Altitude**: 150-210km at T+6-9 minutes
- **Visibility Range**: ~1,400-1,600km radius from rocket position
- **Bermuda Distance**: Perfect positioning at ~900 miles from Florida

#### **Why Bermuda is Ideal**
1. **Distance**: Close enough for visibility, far enough for full trajectory view
2. **Geography**: Northeast of Florida = excellent viewing angle for easterly trajectories  
3. **Dark Skies**: Less light pollution than mainland for night launches
4. **Clear Horizons**: Ocean views provide unobstructed sight lines

### 🛰️ Mission Type Recognition

The app automatically classifies missions based on orbit type:

| Orbit Type | Typical Direction | Visibility | Example Missions |
|------------|------------------|------------|------------------|
| ISS | Northeast | High | Crew Dragon, Cygnus |
| Starlink | **Northeast** | High | Starlink Group missions (53°+ inclination) |
| LEO | East | High | Low-inclination satellites |
| GTO | Southeast | Medium | Commercial comsats |
| Polar/SSO | Northeast | Medium | Weather satellites |
| Unknown | Southeast | Medium | Default assumption |

### 📱 App Features

#### **Launch Cards**
- **Countdown Timer**: Real-time countdown to launch
- **Mission Details**: Rocket type, payload, orbit destination
- **Launch Pad Info**: Specific location (Cape Canaveral vs Kennedy Space Center)
- **Visibility Prediction**: High/Medium/Low/None with reasoning

#### **Trajectory Thumbnails**
- **Flight Club Maps**: Real trajectory visualizations when available
- **Direction Indicators**: Color-coded compass directions (NE, ENE, E, ESE, SE)
- **Visual Confirmation**: Matches predicted trajectory with actual flight path

#### **Beginner-Friendly Explanations**
- **Step-by-step Tracking**: Where to look and when
- **Physics Simplified**: Why rockets are visible from Bermuda
- **Timing Guidance**: When to start watching (T+6 minutes)

#### **Dark Mode Support**
- **Night Vision**: Red-friendly interface for outdoor use
- **Battery Saving**: OLED-optimized dark theme

### 🎯 How to Use for Best Results

#### **Preparation**
1. **Check Launch Schedule**: Opens app several hours before launch
2. **Weather Check**: Clear skies essential for visibility
3. **Location**: Find open area with western horizon view
4. **Equipment**: Binoculars helpful but not required

#### **During Launch**
1. **Start Watching**: T+6 minutes after liftoff
2. **Initial Direction**: Look where app indicates (usually west/southwest)
3. **Track Movement**: Follow rocket as it arcs across sky
4. **Peak Visibility**: Usually T+7 to T+8 minutes
5. **Fade Out**: T+9 minutes as rocket moves away

#### **What to Look For**
- **Bright Moving Dot**: Brighter than aircraft, steady movement
- **Exhaust Plume**: Sometimes visible as glowing trail
- **No Blinking**: Unlike aircraft, rockets don't have navigation lights
- **Steady Arc**: Smooth trajectory across sky

### 🔧 Technical Implementation

#### **Frontend**: React with TypeScript
- **UI Framework**: Tailwind CSS for responsive design
- **State Management**: React hooks for real-time updates
- **Dark Mode**: CSS classes with system preference detection

#### **APIs and Data**
- **Launch Library 2**: Primary launch data source
- **Flight Club**: Trajectory visualization integration
- **Real-time Updates**: Automatic refresh for schedule changes

#### **Calculations**
- **Distance Formulas**: Haversine formula for geographic calculations
- **Bearing Calculations**: Precise compass directions from Bermuda
- **Visibility Physics**: Line-of-sight and orbital mechanics

### 🌟 Why This App Exists

Bermuda's unique geographic position makes it one of the best places in the world to watch rocket launches from Florida. However, knowing exactly when and where to look requires:

1. **Accurate Launch Times**: Launches frequently delay
2. **Trajectory Prediction**: Different missions take different paths
3. **Viewing Directions**: Counterintuitive - must look opposite of rocket destination
4. **Timing Precision**: Visibility window is only 3-4 minutes

This app combines real launch data, orbital mechanics, and geographic calculations to give Bermuda residents the precise information needed for successful rocket spotting.

### 🚀 Success Stories

The app has helped Bermuda residents successfully spot:
- **Crew Dragon launches** to the ISS (northeast trajectories)
- **Starlink deployments** (east-northeast trajectories)  
- **Commercial satellite launches** (southeast trajectories)
- **Cargo missions** to the ISS (northeast trajectories)

### 🔮 Future Enhancements

- **Real-time Trajectory Updates**: Live telemetry integration
- **Weather Integration**: Cloud cover predictions
- **Photo Sharing**: Community rocket photos and reports
- **Launch Notifications**: SMS/email alerts for high-visibility launches
- **Advanced Physics**: Atmospheric refraction corrections
- **Mobile App**: Native iOS/Android versions

---

## 🎯 **CRITICAL CORRECTION: Starlink Group 10-20**

**Previous Error**: Classified as "East" trajectory because orbit type = "Low Earth Orbit"  
**Flight Club Data**: 53.4152° inclination  
**Correct Classification**: **Northeast** trajectory (42.7° launch azimuth)  
**Viewing Direction**: Look **Southwest (225°)** to see rocket coming from Florida  

The app now checks both orbit type AND mission name to correctly identify Starlink missions, even when they're generically labeled as "Low Earth Orbit" in the API data.

### 📊 **Orbital Mechanics Reference**
- **ISS inclination**: 51.6° → Northeast (45° azimuth)
- **Starlink inclination**: 53.4152° → Northeast (42.7° azimuth)  
- **Standard LEO**: 0-30° → East (90° azimuth)
- **GTO missions**: varies → Southeast (135° azimuth)

---

**Built for the Bermuda astronomy and space enthusiast community. Clear skies and successful spotting! 🚀🌙**