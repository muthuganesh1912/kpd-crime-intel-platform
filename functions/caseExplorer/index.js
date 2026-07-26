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

function escapeForZcql(str) {
  return String(str).replace(/'/g, "''");
}

app.get('/caseExplorer', async (req, res) => {
  try {
    const catalystApp = catalyst.initialize(req);
    const zcql = catalystApp.zcql();

    const { district, crimeType, status, search } = req.query;

    const result = await zcql.executeZCQLQuery(
      "SELECT CaseMaster.Crime_no, CaseMaster.CrimeRegistrationDate, CaseMaster.PoliceStationName, CaseMaster.District_Name, CaseMaster.CrimeGroupName, CaseMaster.CrimeSubHeadName, CaseMaster.CaseStatus, CaseMaster.BriefFacts, CaseMaster.Latitude, CaseMaster.Longitude FROM CaseMaster LIMIT 300"
    );
    let cases = result.map(r => r.CaseMaster);

    if (district) cases = cases.filter(c => c.District_Name === district);
    if (crimeType) cases = cases.filter(c => c.CrimeGroupName === crimeType);
    if (status) cases = cases.filter(c => c.CaseStatus === status);
    if (search) {
      const s = search.toLowerCase();
      cases = cases.filter(c =>
        (c.Crime_no && c.Crime_no.toLowerCase().includes(s)) ||
        (c.PoliceStationName && c.PoliceStationName.toLowerCase().includes(s)) ||
        (c.BriefFacts && c.BriefFacts.toLowerCase().includes(s))
      );
    }

    // sort newest first
    cases.sort((a, b) => (b.CrimeRegistrationDate || '').localeCompare(a.CrimeRegistrationDate || ''));

    res.status(200).send({
      status: 'success',
      totalResults: cases.length,
      cases
    });
  } catch (err) {
    console.error(err);
    res.status(500).send({ status: 'failure', error: err.message });
  }
});

// single-case detail lookup by crime number, e.g. /caseExplorer/detail?crimeNo=10006202410006
app.get('/caseExplorer/detail', async (req, res) => {
  try {
    const catalystApp = catalyst.initialize(req);
    const zcql = catalystApp.zcql();
    const crimeNo = req.query.crimeNo;
    if (!crimeNo) {
      return res.status(400).send({ status: 'failure', error: 'Missing crimeNo query parameter' });
    }

    const caseResult = await zcql.executeZCQLQuery(
      `SELECT CaseMaster.Crime_no, CaseMaster.CrimeRegistrationDate, CaseMaster.PoliceStationName, CaseMaster.District_Name, CaseMaster.CrimeGroupName, CaseMaster.CrimeSubHeadName, CaseMaster.CaseStatus, CaseMaster.BriefFacts, CaseMaster.Latitude, CaseMaster.Longitude FROM CaseMaster WHERE CaseMaster.Crime_no = '${escapeForZcql(crimeNo)}' LIMIT 1`
    );
    if (caseResult.length === 0) {
      return res.status(404).send({ status: 'failure', error: 'No case found with that crime number' });
    }
    const caseData = caseResult[0].CaseMaster;

    const accusedResult = await zcql.executeZCQLQuery(
      `SELECT Accused.AccusedName, Accused.AgeYear, Accused.GenderID, Accused.PersonID FROM Accused WHERE Accused.CrimeNo = '${escapeForZcql(crimeNo)}' LIMIT 50`
    );
    const accused = accusedResult.map(r => r.Accused);

    res.status(200).send({
      status: 'success',
      case: caseData,
      accused
    });
  } catch (err) {
    console.error(err);
    res.status(500).send({ status: 'failure', error: err.message });
  }
});

module.exports = app;