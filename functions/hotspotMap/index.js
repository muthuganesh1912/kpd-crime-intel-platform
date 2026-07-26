'use strict';
const express = require('express');
const catalyst = require('zcatalyst-sdk-node');
const app = express();
app.use(express.json());

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

app.get('/hotspotMap', async (req, res) => {
  try {
    const catalystApp = catalyst.initialize(req);
    const zcql = catalystApp.zcql();

    const result = await zcql.executeZCQLQuery(
      "SELECT CaseMaster.Crime_no, CaseMaster.District_Name, CaseMaster.PoliceStationName, CaseMaster.CrimeGroupName, CaseMaster.Latitude, CaseMaster.Longitude, CaseMaster.CaseStatus FROM CaseMaster LIMIT 300"
    );
    const cases = result.map(r => r.CaseMaster);

    // raw points for plotting individual markers / heat layer
    const points = cases
      .filter(c => c.Latitude != null && c.Longitude != null)
      .map(c => ({
        crimeNo: c.Crime_no,
        lat: parseFloat(c.Latitude),
        lng: parseFloat(c.Longitude),
        crimeType: c.CrimeGroupName,
        district: c.District_Name,
        station: c.PoliceStationName,
        status: c.CaseStatus
      }));

    // per-district intensity summary (for legend / sidebar panel)
    const districtStats = {};
    cases.forEach(c => {
      if (!districtStats[c.District_Name]) {
        districtStats[c.District_Name] = { totalFIRs: 0, crimeTypeCounts: {} };
      }
      districtStats[c.District_Name].totalFIRs++;
      districtStats[c.District_Name].crimeTypeCounts[c.CrimeGroupName] =
        (districtStats[c.District_Name].crimeTypeCounts[c.CrimeGroupName] || 0) + 1;
    });

    const districtSummary = Object.entries(districtStats).map(([name, stats]) => {
      const topCrime = Object.entries(stats.crimeTypeCounts).sort((a, b) => b[1] - a[1])[0];
      return {
        district: name,
        totalFIRs: stats.totalFIRs,
        topCrimeType: topCrime ? topCrime[0] : null,
        intensity: stats.totalFIRs >= 35 ? 'High' : stats.totalFIRs >= 20 ? 'Medium' : 'Low'
      };
    }).sort((a, b) => b.totalFIRs - a.totalFIRs);

    // per-police-station breakdown (for the table under the map, matching your mockup)
    const stationStats = {};
    cases.forEach(c => {
      if (!stationStats[c.PoliceStationName]) {
        stationStats[c.PoliceStationName] = { district: c.District_Name, totalFIRs: 0 };
      }
      stationStats[c.PoliceStationName].totalFIRs++;
    });
    const stationSummary = Object.entries(stationStats)
      .map(([name, stats]) => ({ station: name, district: stats.district, totalFIRs: stats.totalFIRs }))
      .sort((a, b) => b.totalFIRs - a.totalFIRs);

    res.status(200).send({
      status: 'success',
      points,
      districtSummary,
      stationSummary
    });
  } catch (err) {
    console.error(err);
    res.status(500).send({ status: 'failure', error: err.message });
  }
});

module.exports = app;