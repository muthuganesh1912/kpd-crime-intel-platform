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

function inRange(dateStr, from, to) {
  if (!dateStr) return false;
  const d = dateStr.split(' ')[0];
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

function daysBetween(dateStr) {
  if (!dateStr) return null;
  const then = new Date(dateStr.split(' ')[0] + 'T00:00:00');
  if (isNaN(then.getTime())) return null;
  return Math.floor((Date.now() - then.getTime()) / (1000 * 60 * 60 * 24));
}

app.get('/reports', async (req, res) => {
  try {
    const catalystApp = catalyst.initialize(req);
    const zcql = catalystApp.zcql();

    const { type = 'summary', from, to } = req.query;

    const result = await zcql.executeZCQLQuery(
      "SELECT CaseMaster.Crime_no, CaseMaster.CrimeRegistrationDate, CaseMaster.District_Name, CaseMaster.PoliceStationName, CaseMaster.CrimeGroupName, CaseMaster.CaseStatus FROM CaseMaster LIMIT 300"
    );
    let cases = result.map(r => r.CaseMaster);

    if (from || to) {
      cases = cases.filter(c => inRange(c.CrimeRegistrationDate, from, to));
    }

    const totalCases = cases.length;

    if (type === 'summary') {
      const statusCounts = {};
      cases.forEach(c => { statusCounts[c.CaseStatus] = (statusCounts[c.CaseStatus] || 0) + 1; });

      const districtCounts = {};
      cases.forEach(c => { districtCounts[c.District_Name] = (districtCounts[c.District_Name] || 0) + 1; });
      const topDistrict = Object.entries(districtCounts).sort((a, b) => b[1] - a[1])[0];

      const headCounts = {};
      cases.forEach(c => { headCounts[c.CrimeGroupName] = (headCounts[c.CrimeGroupName] || 0) + 1; });
      const topHead = Object.entries(headCounts).sort((a, b) => b[1] - a[1])[0];

      const dates = cases.map(c => c.CrimeRegistrationDate && c.CrimeRegistrationDate.split(' ')[0]).filter(Boolean).sort();

      return res.status(200).send({
        status: 'success',
        type,
        totalCases,
        dateRange: { earliest: dates[0] || null, latest: dates[dates.length - 1] || null },
        statusBreakdown: Object.entries(statusCounts).map(([name, count]) => ({ name, count })),
        topDistrict: topDistrict ? { name: topDistrict[0], count: topDistrict[1] } : null,
        topCrimeHead: topHead ? { name: topHead[0], count: topHead[1] } : null,
        columns: ['Metric', 'Value'],
        rows: [
          ['Total Cases', totalCases],
          ['Under Investigation', statusCounts['Under Investigation'] || 0],
          ['Charge Sheet Filed', statusCounts['Charge Sheet Filed'] || 0],
          ['Final Report', statusCounts['Final Report'] || 0],
          ['Closed', statusCounts['Closed'] || 0],
          ['Top District', topDistrict ? `${topDistrict[0]} (${topDistrict[1]})` : '-'],
          ['Top Crime Head', topHead ? `${topHead[0]} (${topHead[1]})` : '-']
        ]
      });
    }

    if (type === 'district') {
      const stats = {};
      cases.forEach(c => {
        if (!stats[c.District_Name]) stats[c.District_Name] = { total: 0, statuses: {} };
        stats[c.District_Name].total++;
        stats[c.District_Name].statuses[c.CaseStatus] = (stats[c.District_Name].statuses[c.CaseStatus] || 0) + 1;
      });
      const rows = Object.entries(stats)
        .map(([name, s]) => [name, s.total, s.statuses['Under Investigation'] || 0, s.statuses['Closed'] || 0])
        .sort((a, b) => b[1] - a[1]);
      return res.status(200).send({
        status: 'success', type, totalCases,
        columns: ['District', 'Total Cases', 'Under Investigation', 'Closed'],
        rows,
        chart: { labels: rows.map(r => r[0]), values: rows.map(r => r[1]) }
      });
    }

    if (type === 'crimehead') {
      const stats = {};
      cases.forEach(c => { stats[c.CrimeGroupName] = (stats[c.CrimeGroupName] || 0) + 1; });
      const rows = Object.entries(stats).sort((a, b) => b[1] - a[1]).map(([name, count]) => [name, count]);
      return res.status(200).send({
        status: 'success', type, totalCases,
        columns: ['Crime Head', 'Total Cases'],
        rows,
        chart: { labels: rows.map(r => r[0]), values: rows.map(r => r[1]) }
      });
    }

    if (type === 'station') {
      const stats = {};
      cases.forEach(c => {
        if (!stats[c.PoliceStationName]) stats[c.PoliceStationName] = { district: c.District_Name, total: 0 };
        stats[c.PoliceStationName].total++;
      });
      const rows = Object.entries(stats)
        .map(([name, s]) => [name, s.district, s.total])
        .sort((a, b) => b[2] - a[2]);
      return res.status(200).send({
        status: 'success', type, totalCases,
        columns: ['Station', 'District', 'Total Cases'],
        rows,
        chart: { labels: rows.slice(0, 10).map(r => r[0]), values: rows.slice(0, 10).map(r => r[2]) }
      });
    }

    if (type === 'pending') {
      const pending = cases
        .filter(c => c.CaseStatus === 'Under Investigation')
        .map(c => ({ ...c, daysOpen: daysBetween(c.CrimeRegistrationDate) }))
        .filter(c => c.daysOpen !== null)
        .sort((a, b) => b.daysOpen - a.daysOpen)
        .slice(0, 100);
      const rows = pending.map(c => [c.Crime_no.slice(-6), c.PoliceStationName, c.District_Name, c.CrimeGroupName, c.daysOpen]);
      return res.status(200).send({
        status: 'success', type, totalCases: pending.length,
        columns: ['FIR No.', 'Station', 'District', 'Crime Head', 'Days Open'],
        rows
      });
    }

    res.status(400).send({ status: 'failure', error: `Unknown report type: ${type}` });
  } catch (err) {
    console.error(err);
    res.status(500).send({ status: 'failure', error: err.message });
  }
});

module.exports = app;