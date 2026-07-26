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

function daysBetween(dateStr) {
  if (!dateStr) return null;
  const then = new Date(dateStr.split(' ')[0] + 'T00:00:00');
  if (isNaN(then.getTime())) return null;
  return Math.floor((Date.now() - then.getTime()) / (1000 * 60 * 60 * 24));
}

app.get('/alerts', async (req, res) => {
  try {
    const catalystApp = catalyst.initialize(req);
    const zcql = catalystApp.zcql();

    const caseResult = await zcql.executeZCQLQuery(
      "SELECT CaseMaster.Crime_no, CaseMaster.CrimeRegistrationDate, CaseMaster.District_Name, CaseMaster.PoliceStationName, CaseMaster.CrimeGroupName, CaseMaster.CaseStatus FROM CaseMaster LIMIT 300"
    );
    const cases = caseResult.map(r => r.CaseMaster);

    const accusedResult = await zcql.executeZCQLQuery(
      "SELECT Accused.AccusedName, Accused.CrimeNo, Accused.AgeYear, Accused.GenderID FROM Accused LIMIT 300"
    );
    const accusedRows = accusedResult.map(r => r.Accused);

    const alerts = [];
    let alertId = 1;

    // 1. Long-pending investigations
    cases
      .filter(c => c.CaseStatus === 'Under Investigation')
      .forEach(c => {
        const days = daysBetween(c.CrimeRegistrationDate);
        if (days === null) return;
        if (days >= 90) {
          alerts.push({
            id: 'AL' + alertId++,
            type: 'pending_investigation',
            severity: days >= 180 ? 'High' : 'Medium',
            title: `FIR pending ${days} days`,
            description: `Crime No. ${c.Crime_no.slice(-6)} (${c.CrimeGroupName}) at ${c.PoliceStationName}, ${c.District_Name} has been under investigation for ${days} days.`,
            district: c.District_Name,
            crimeNo: c.Crime_no,
            daysOpen: days
          });
        }
      });

    // 2. District crime spikes: last 30 days vs. prior 30 days
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const recentByDistrict = {};
    const priorByDistrict = {};
    cases.forEach(c => {
      if (!c.CrimeRegistrationDate) return;
      const d = new Date(c.CrimeRegistrationDate.split(' ')[0] + 'T00:00:00');
      if (isNaN(d.getTime())) return;
      const age = (now - d.getTime()) / day;
      if (age >= 0 && age < 30) {
        recentByDistrict[c.District_Name] = (recentByDistrict[c.District_Name] || 0) + 1;
      } else if (age >= 30 && age < 60) {
        priorByDistrict[c.District_Name] = (priorByDistrict[c.District_Name] || 0) + 1;
      }
    });
    Object.keys(recentByDistrict).forEach(district => {
      const recent = recentByDistrict[district];
      const prior = priorByDistrict[district] || 0;
      if (prior >= 3 && recent > prior * 1.5) {
        const pctChange = Math.round(((recent - prior) / prior) * 100);
        alerts.push({
          id: 'AL' + alertId++,
          type: 'crime_spike',
          severity: pctChange >= 100 ? 'High' : 'Medium',
          title: `Crime spike in ${district}`,
          description: `${district} recorded ${recent} cases in the last 30 days vs. ${prior} in the prior 30 days (+${pctChange}%).`,
          district,
          daysOpen: null
        });
      }
    });

    // 3. Repeat offenders (3+ linked cases still present in CaseMaster)
    const caseByCrimeNo = {};
    cases.forEach(c => { caseByCrimeNo[c.Crime_no] = c; });
    const byName = {};
    accusedRows.forEach(a => {
      if (!caseByCrimeNo[a.CrimeNo]) return;
      if (!byName[a.AccusedName]) byName[a.AccusedName] = [];
      byName[a.AccusedName].push(a);
    });
    Object.entries(byName).forEach(([name, records]) => {
      if (records.length >= 3) {
        const districts = [...new Set(records.map(r => caseByCrimeNo[r.CrimeNo].District_Name))];
        alerts.push({
          id: 'AL' + alertId++,
          type: 'repeat_offender',
          severity: records.length >= 5 ? 'High' : 'Medium',
          title: `Repeat offender: ${name}`,
          description: `${name} is linked to ${records.length} cases across ${districts.join(', ')}.`,
          district: districts[0],
          daysOpen: null
        });
      }
    });

    // sort: High severity first, then by daysOpen desc
    const severityRank = { High: 0, Medium: 1, Low: 2 };
    alerts.sort((a, b) => (severityRank[a.severity] - severityRank[b.severity]) || ((b.daysOpen || 0) - (a.daysOpen || 0)));

    const summary = {
      total: alerts.length,
      high: alerts.filter(a => a.severity === 'High').length,
      medium: alerts.filter(a => a.severity === 'Medium').length,
      pendingInvestigations: alerts.filter(a => a.type === 'pending_investigation').length,
      crimeSpikes: alerts.filter(a => a.type === 'crime_spike').length,
      repeatOffenders: alerts.filter(a => a.type === 'repeat_offender').length
    };

    res.status(200).send({ status: 'success', summary, alerts });
  } catch (err) {
    console.error(err);
    res.status(500).send({ status: 'failure', error: err.message });
  }
});

module.exports = app;