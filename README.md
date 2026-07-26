# KPD Crime Intelligence Platform

A comprehensive crime intelligence and analytics platform for the Karnataka State Police (KSP) to track, analyze, and manage crime data across the state.

## Overview

The KPD Crime Intelligence Platform is a web-based application that provides deep insights into crime patterns, trends, and hotspots across Karnataka. It enables law enforcement officers to make data-driven decisions through interactive dashboards, advanced analytics, and AI-powered assistance.

## Features

### 📊 Core Features

- **Crime Analytics Dashboard**: Real-time crime statistics, trends, and patterns
- **Hotspot Map**: Geographic visualization of crime incidents with heat mapping
- **Case Explorer**: Search and manage individual case records
- **Network Analysis**: Visualize connections between accused individuals and cases
- **AI Crime Assistant**: Natural language querying for crime data
- **Alerts Management**: Real-time alert system for critical incidents
- **Reports Generation**: Automated report generation for law enforcement
- **Investigation Analysis**: Track investigation progress and case status

### 📈 Analytics Capabilities

- Monthly and yearly crime trend analysis
- Crime category distribution and breakdown
- District-wise and station-wise crime comparison
- Repeat offender identification
- Crime by time-of-day heatmaps
- Status-based case filtering (Under Investigation, Charge Sheet Filed, Final Report, Closed)
- Geographic hotspot identification

### 🤖 AI Assistant

- Natural language query processing
- Crime type and district detection
- Intent-based analytics (trends, repeat offenders, top areas, etc.)
- Privacy and bias-aware responses
- Multi-language support ready

## Project Structure

```
kpd-crime-intel-platform/
├── functions/
│   ├── aiCrimeAssistant/          # AI-powered crime query assistant
│   │   ├── index.js               # Main assistant logic
│   │   ├── package.json
│   │   └── catalyst-config.json
│   ├── dashboardStats/            # Dashboard analytics endpoints
│   │   ├── index.js               # Dashboard and hotspot data
│   │   ├── package.json
│   │   └── catalyst-config.json
│   ├── kpd_crime_intel_platform_function/  # Data seeding
│   │   ├── index.js               # Sample data generation
│   │   ├── package.json
│   │   └── catalyst-config.json
│   ├── crimeAnalytics/            # Crime analytics module
│   ├── hotspotMap/                # Hotspot mapping module
│   ├── caseExplorer/              # Case search and explore
│   ├── networkAnalysis/           # Network analysis module
│   ├── alerts/                    # Alert management
│   └── reports/                   # Report generation
├── ai_assistant.html              # AI assistant frontend
├── crime_analytics.html            # Crime analytics dashboard
├── dashboard_analytics.html        # Interactive analytics dashboard
├── hotspot_map.html               # Hotspot map interface
├── case_explorer.html             # Case search interface
├── network_analysis.html          # Network visualization
├── alerts.html                    # Alerts management
├── reports.html                   # Reports interface
├── dashboard.html                 # Main dashboard
├── catalyst.json                  # Catalyst project configuration
├── .catalystrc                    # Catalyst CLI config
└── README.md                      # This file
```

## Technology Stack

### Backend
- **Node.js**: Runtime environment
- **Express.js**: Web framework
- **Catalyst SDK**: Backend-as-a-service platform
- **ZCQL**: Query language for Catalyst datastore

### Frontend
- **HTML5**: Markup language
- **CSS3**: Styling with responsive design
- **JavaScript (ES6+)**: Client-side logic
- **Chart.js**: Interactive charting library

### Database
- **Catalyst Datastore**: NoSQL database for crime records
- **ZCQL**: Query language for data retrieval

## API Endpoints

### Dashboard Statistics
```
GET /dashboardStats
```
Returns:
- Total FIRs count
- Case status breakdown (Under Investigation, Charge Sheet Filed, Final Report, Closed)
- Crime category distribution
- Top districts
- Top police stations
- Monthly trend data

### Hotspot Data
```
GET /hotspotData
```
Returns:
- Geo-tagged crime points (latitude, longitude)
- Crime filters (types, districts, statuses)
- Top hotspot stations
- Total points count

### AI Crime Assistant
```
POST /aiCrimeAssistant
Body: { "query": "user's natural language question" }
```
Returns:
- Detected crime type, district, status
- Identified intent
- Contextual answer
- Chart data (if applicable)

Supported queries:
- "Show theft cases in Bengaluru"
- "What is the trend for robbery?"
- "Which are the top areas for crime?"
- "Show repeat offenders"
- "Crime trend over the last 12 months"

### Data Seeding
```
GET /seedData
```
Generates sample crime cases and accused records for testing.

## Setup Instructions

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn
- Catalyst CLI
- A Catalyst account and project

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/muthuganesh1912/kpd-crime-intel-platform.git
   cd kpd-crime-intel-platform
   ```

2. **Install dependencies**
   ```bash
   cd functions/aiCrimeAssistant && npm install
   cd ../dashboardStats && npm install
   cd ../kpd_crime_intel_platform_function && npm install
   cd ../..
   ```

3. **Configure Catalyst**
   - Update `catalyst.json` with your Catalyst project credentials
   - Configure `.catalystrc` with your authentication details

4. **Deploy functions**
   ```bash
   catalyst deploy
   ```

5. **Open the dashboard**
   - Open `dashboard.html` in your browser
   - Or use a local server: `npx http-server`

## Usage

### Accessing the Dashboard

1. **Via File System**
   ```
   file:///path/to/dashboard_analytics.html
   ```

2. **Via Local Server**
   ```bash
   npx http-server
   # Open http://localhost:8080/dashboard_analytics.html
   ```

### Using the AI Assistant

1. Navigate to the AI Crime Assistant page
2. Enter natural language queries:
   - "Show me theft cases"
   - "What districts have the most crime?"
   - "List repeat offenders"
   - "Show crime trends"

### Generating Reports

1. Go to Reports section
2. Select filters (date range, district, crime type)
3. Click "Generate Report"
4. Export as PDF/Excel

## Data Models

### CaseMaster Table
- `Crime_no`: Unique crime case identifier
- `CrimeRegistrationDate`: Date of crime registration
- `District_Name`: District where crime occurred
- `PoliceStationName`: Police station jurisdiction
- `CrimeGroupName`: Category of crime (Theft, Assault, etc.)
- `CaseStatus`: Current case status
- `Latitude`: Crime location latitude
- `Longitude`: Crime location longitude
- `BriefFacts`: Summary of the incident

### Accused Table
- `CrimeNo`: Associated crime case number
- `AccusedName`: Name of accused person
- `AgeYear`: Age of accused
- `GenderID`: Gender identifier
- `PersonID`: Unique person identifier

## Crime Categories

The platform tracks the following crime types:
- **Theft**: Larceny, burglary, stealing
- **Assault**: Physical attacks, beating
- **Robbery**: Snatching, mugging, armed robbery
- **Cheating**: Fraud, scams
- **Kidnapping**: Abduction, hostage
- **Criminal Intimidation**: Threats, threatening behavior

## Districts Covered

- Bengaluru City
- Bengaluru Rural
- Mysuru
- Belagavi
- Dharwad
- Tumakuru

## Security & Privacy

- ✅ Privacy-aware AI assistant (blocks sensitive queries)
- ✅ Role-based access control ready
- ✅ Bias detection in analytics
- ✅ Confidential data protection
- ✅ CORS enabled for secure cross-origin requests

## Limitations & Future Enhancements

### Current Limitations
- Mock data generation for demonstration
- Limited to historical data (no real-time streaming)
- Batch processing for reports

### Planned Features
- Real-time crime alert streaming
- Predictive analytics using ML models
- Integration with multiple data sources
- Mobile app
- Advanced network analysis visualization
- Multi-language support
- Integration with external law enforcement databases

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Support

For support, contact:
- **Support Center**: 080-2236-4444
- **Email**: support@kspcrimes.gov.in

## License

This project is licensed under the Government of Karnataka - All Rights Reserved.

## Disclaimer

This platform is designed for authorized law enforcement personnel only. Unauthorized access or use is prohibited by law.

## Last Updated

31 May 2024, 10:30 AM

---

**Karnataka State Police Crime Intelligence Platform**
*Deep insights into crime patterns and trends across Karnataka*
