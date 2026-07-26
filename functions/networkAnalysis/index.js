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

app.get('/networkAnalysis', async (req, res) => {
  try {
    const catalystApp = catalyst.initialize(req);
    const zcql = catalystApp.zcql();

    const caseResult = await zcql.executeZCQLQuery(
      "SELECT CaseMaster.Crime_no, CaseMaster.PoliceStationName, CaseMaster.District_Name, CaseMaster.CrimeGroupName, CaseMaster.CaseStatus FROM CaseMaster LIMIT 300"
    );
    const cases = caseResult.map(r => r.CaseMaster);
    const caseByCrimeNo = {};
    cases.forEach(c => { caseByCrimeNo[c.Crime_no] = c; });

    const accusedResult = await zcql.executeZCQLQuery(
      "SELECT Accused.AccusedName, Accused.CrimeNo, Accused.AgeYear, Accused.GenderID FROM Accused LIMIT 300"
    );
    const accusedRows = accusedResult.map(r => r.Accused);

    // group accused rows by name to find repeat offenders (same person, multiple cases)
    const accusedByName = {};
    accusedRows.forEach(a => {
      if (!accusedByName[a.AccusedName]) accusedByName[a.AccusedName] = [];
      accusedByName[a.AccusedName].push(a);
    });

    const nodes = [];
    const edges = [];
    const addedStationNodes = new Set();
    const addedCaseNodes = new Set();
    let nodeIdCounter = 1;
    const accusedNodeId = {};

    // only include accused with at least one linked case that still exists in CaseMaster
    Object.entries(accusedByName).forEach(([name, records]) => {
      const validRecords = records.filter(r => caseByCrimeNo[r.CrimeNo]);
      if (validRecords.length === 0) return;

      const accusedId = 'A' + nodeIdCounter++;
      accusedNodeId[name] = accusedId;
      nodes.push({
        id: accusedId,
        label: name,
        type: 'accused',
        isRepeatOffender: validRecords.length >= 2,
        linkedCases: validRecords.length,
        age: validRecords[0].AgeYear,
        gender: validRecords[0].GenderID
      });

      validRecords.forEach(r => {
        const c = caseByCrimeNo[r.CrimeNo];
        const caseNodeId = 'C_' + r.CrimeNo;
        if (!addedCaseNodes.has(caseNodeId)) {
          addedCaseNodes.add(caseNodeId);
          nodes.push({
            id: caseNodeId,
            label: c.CrimeGroupName + ' (' + r.CrimeNo.slice(-4) + ')',
            type: 'case',
            crimeType: c.CrimeGroupName,
            status: c.CaseStatus,
            district: c.District_Name
          });
        }
        edges.push({ from: accusedId, to: caseNodeId, relation: 'accused_in' });

        const stationNodeId = 'S_' + c.PoliceStationName;
        if (!addedStationNodes.has(stationNodeId)) {
          addedStationNodes.add(stationNodeId);
          nodes.push({
            id: stationNodeId,
            label: c.PoliceStationName,
            type: 'station',
            district: c.District_Name
          });
        }
        edges.push({ from: caseNodeId, to: stationNodeId, relation: 'registered_at' });
      });
    });

    // co-accused edges: two different repeat offenders who share at least one police station
    // (approximates "associates" since we don't have a direct case-to-multiple-accused join in this dataset)
    const repeatOffenderNames = Object.keys(accusedByName).filter(name =>
      accusedByName[name].filter(r => caseByCrimeNo[r.CrimeNo]).length >= 2
    );
    for (let i = 0; i < repeatOffenderNames.length; i++) {
      for (let j = i + 1; j < repeatOffenderNames.length; j++) {
        const nameA = repeatOffenderNames[i];
        const nameB = repeatOffenderNames[j];
        const stationsA = new Set(accusedByName[nameA].filter(r => caseByCrimeNo[r.CrimeNo]).map(r => caseByCrimeNo[r.CrimeNo].PoliceStationName));
        const stationsB = new Set(accusedByName[nameB].filter(r => caseByCrimeNo[r.CrimeNo]).map(r => caseByCrimeNo[r.CrimeNo].PoliceStationName));
        const shared = [...stationsA].some(s => stationsB.has(s));
        if (shared) {
          edges.push({ from: accusedNodeId[nameA], to: accusedNodeId[nameB], relation: 'associate' });
        }
      }
    }

    res.status(200).send({
      status: 'success',
      nodes,
      edges,
      repeatOffenderCount: repeatOffenderNames.length
    });
  } catch (err) {
    console.error(err);
    res.status(500).send({ status: 'failure', error: err.message });
  }
});

module.exports = app;