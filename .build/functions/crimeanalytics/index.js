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

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

app.get('/crimeAnalytics', async (req, res) => {
  try {
    const catalystApp = catalyst.initialize(req);
    const zcql = catalystApp.zcql();

    const result = await zcql.executeZCQLQuery(
      "SELECT CaseMaster.Crime_no, CaseMaster.CrimeRegistrationDate, CaseMaster.District_Name, CaseMaster.PoliceStationName, CaseMaster.CrimeGroupName, CaseMaster.CaseStatus FROM CaseMaster LIMIT 300"
    );
    const cases = result.map(r => r.CaseMaster);

    // --- Crime trend (last 12 months) ---
    const monthly = {};
    cases.forEach(c => {
      if (!c.CrimeRegistrationDate) return;
      const key = c.CrimeRegistrationDate.split(' ')[0].slice(0, 7);
      monthly[key] = (monthly[key] || 0) + 1;
    });
    const crimeTrend = Object.entries(monthly)
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // --- Crime by crime head (top 7) ---
    const headCounts = {};
    cases.forEach(c => { headCounts[c.CrimeGroupName] = (headCounts[c.CrimeGroupName] || 0) + 1; });
    const crimeByHead = Object.entries(headCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 7);

    // --- Crime by district (top 10) ---
    const districtCounts = {};
    cases.forEach(c => { districtCounts[c.District_Name] = (districtCounts[c.District_Name] || 0) + 1; });
    const crimeByDistrict = Object.entries(districtCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // --- Crime by time of day x day of week (heatmap grid) ---
    // buckets: 12AM-4AM, 4AM-8AM, 8AM-12PM, 12PM-4PM, 4PM-8PM, 8PM-12AM
    const timeBuckets = ['12 AM - 4 AM', '4 AM - 8 AM', '8 AM - 12 PM', '12 PM - 4 PM', '4 PM - 8 PM', '8 PM - 12 AM'];
    const heatmap = {}; // heatmap[day][bucketIndex] = count
    DAY_NAMES.forEach(day => { heatmap[day] = new Array(6).fill(0); });

    cases.forEach(c => {
      if (!c.CrimeRegistrationDate) return;
      const [datePart, timePart] = c.CrimeRegistrationDate.split(' ');
      const dateObj = new Date(datePart + 'T' + (timePart || '00:00:00'));
      if (isNaN(dateObj.getTime())) return;
      const dayName = DAY_NAMES[dateObj.getDay()];
      const hour = timePart ? parseInt(timePart.split(':')[0], 10) : 0;
      const bucketIndex = Math.floor(hour / 4);
      heatmap[dayName][bucketIndex]++;
    });

    // --- FIR status distribution ---
    const statusCounts = {};
    cases.forEach(c => { statusCounts[c.CaseStatus] = (statusCounts[c.CaseStatus] || 0) + 1; });
    const statusDistribution = Object.entries(statusCounts).map(([name, count]) => ({ name, count }));

    // --- Key insights (simple derived stats) ---
    const totalCases = cases.length;
    const topDistrict = crimeByDistrict[0] || null;
    const topCrimeHead = crimeByHead[0] || null;

    res.status(200).send({
      status: 'success',
      totalCases,
      crimeTrend,
      crimeByHead,
      crimeByDistrict,
      timeOfDayHeatmap: { days: DAY_NAMES, buckets: timeBuckets, data: heatmap },
      statusDistribution,
      insights: {
        topDistrict: topDistrict ? topDistrict.name : null,
        topDistrictCount: topDistrict ? topDistrict.count : null,
        topCrimeHead: topCrimeHead ? topCrimeHead.name : null,
        topCrimeHeadCount: topCrimeHead ? topCrimeHead.count : null
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).send({ status: 'failure', error: err.message });
  }
});

module.exports = app;