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

app.get('/dashboardStats', async (req, res) => {
  try {
    const catalystApp = catalyst.initialize(req);
    const zcql = catalystApp.zcql();

    const query = "SELECT CaseMaster.Crime_no, CaseMaster.CrimeRegistrationDate, CaseMaster.District_Name, CaseMaster.PoliceStationName, CaseMaster.CrimeGroupName, CaseMaster.CaseStatus FROM CaseMaster LIMIT 300";
    const result = await zcql.executeZCQLQuery(query);

    // result rows come back as [{ CaseMaster: { Crime_no: ..., ... } }, ...]
    const cases = result.map(r => r.CaseMaster);

    const totalFIRs = cases.length;
    const openCases = cases.filter(c => c.CaseStatus === 'Under Investigation').length;
    const chargeSheetFiled = cases.filter(c => c.CaseStatus === 'Charge Sheet Filed').length;
    const closed = cases.filter(c => c.CaseStatus === 'Closed').length;
    const finalReport = cases.filter(c => c.CaseStatus === 'Final Report').length;

    // Crime category distribution
    const categoryCount = {};
    cases.forEach(c => {
      categoryCount[c.CrimeGroupName] = (categoryCount[c.CrimeGroupName] || 0) + 1;
    });
    const crimeCategoryDistribution = Object.entries(categoryCount)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    // Top districts
    const districtCount = {};
    cases.forEach(c => {
      districtCount[c.District_Name] = (districtCount[c.District_Name] || 0) + 1;
    });
    const topDistricts = Object.entries(districtCount)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Monthly trend (last 12 months)
    const monthlyCounts = {};
    cases.forEach(c => {
      if (!c.CrimeRegistrationDate) return;
      const dateStr = c.CrimeRegistrationDate.split(' ')[0]; // "YYYY-MM-DD"
      const [year, month] = dateStr.split('-');
      const key = `${year}-${month}`;
      monthlyCounts[key] = (monthlyCounts[key] || 0) + 1;
    });
    const firsOverTime = Object.entries(monthlyCounts)
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // Top police stations
    const stationCount = {};
    cases.forEach(c => {
      stationCount[c.PoliceStationName] = (stationCount[c.PoliceStationName] || 0) + 1;
    });
    const topStations = Object.entries(stationCount)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    res.status(200).send({
      status: "success",
      summary: {
        totalFIRs,
        openCases,
        chargeSheetFiled,
        finalReport,
        closed
      },
      crimeCategoryDistribution,
      topDistricts,
      topStations,
      firsOverTime
    });
  } catch (err) {
    console.error(err);
    res.status(500).send({ status: "failure", error: err.message });
  }
});

module.exports = app;