'use strict';
const express = require('express');
const catalyst = require('zcatalyst-sdk-node');
const app = express();
app.use(express.json());

function formatDateForCatalyst(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

app.get('/seedData', async (req, res) => {
  const catalystApp = catalyst.initialize(req);
  const datastore = catalystApp.datastore();

  const districts = ["Bengaluru City", "Bengaluru Rural", "Mysuru", "Belagavi", "Dharwad", "Tumakuru"];
  const stationsByDistrict = {
    "Bengaluru City": ["Jayanagar PS", "HSR Layout PS", "Koramangala PS", "Whitefield PS", "Hebbal PS"],
    "Bengaluru Rural": ["Devanahalli PS", "Nelamangala PS"],
    "Mysuru": ["Mysuru City PS", "Nazarbad PS"],
    "Belagavi": ["Belagavi Rural PS"],
    "Dharwad": ["Hubballi PS"],
    "Tumakuru": ["Tumakuru Town PS"]
  };
  const crimeHeads = ["Theft", "Assault", "Robbery", "Cheating", "Kidnapping", "Criminal Intimidation"];
  const statuses = ["Under Investigation", "Charge Sheet Filed", "Final Report", "Closed"];

  const caseTable = datastore.table("CaseMaster");
  const accusedTable = datastore.table("Accused");

  const rows = [];
  const accusedRows = [];
  const repeatOffenderNames = ["Ramesh P", "Suresh M", "Mahesh K"];

  for (let i = 0; i < 200; i++) {
    const district = districts[Math.floor(Math.random() * districts.length)];
    const stations = stationsByDistrict[district];
    const station = stations[Math.floor(Math.random() * stations.length)];
    const crimeHead = crimeHeads[Math.floor(Math.random() * crimeHeads.length)];
    const status = statuses[Math.floor(Math.random() * statuses.length)];

    const daysAgo = Math.floor(Math.random() * 365);
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    const hour = Math.random() < 0.4 ? 18 + Math.floor(Math.random() * 6) : Math.floor(Math.random() * 24);
    date.setHours(hour);

    const crimeNo = `1${String(i).padStart(4, '0')}2024${String(10000 + i)}`;

    rows.push({
      Crime_no: crimeNo,
      CrimeRegistrationDate: formatDateForCatalyst(date),
      PoliceStationName: station,
      District_Name: district,
      CrimeGroupName: crimeHead,
      CrimeSubHeadName: crimeHead,
      CaseStatus: status,
      Latitude: parseFloat((12.5 + Math.random() * 3).toFixed(6)),
      Longitude: parseFloat((75.5 + Math.random() * 3).toFixed(6)),
      BriefFacts: `Sample ${crimeHead} incident reported at ${station}.`
    });

    if (Math.random() < 0.15) {
      const name = repeatOffenderNames[Math.floor(Math.random() * repeatOffenderNames.length)];
      accusedRows.push({
        CrimeNo: crimeNo,
        AccusedName: name,
        AgeYear: 25 + Math.floor(Math.random() * 20),
        GenderID: "M",
        PersonID: "A1"
      });
    }
  }

  try {
    const inserted = await caseTable.insertRows(rows);
    const insertedAccused = accusedRows.length > 0
      ? await accusedTable.insertRows(accusedRows)
      : [];
    res.status(200).send({
      status: "success",
      casesInserted: inserted.length,
      accusedInserted: insertedAccused.length
    });
  } catch (err) {
    console.error(err);
    res.status(500).send({ status: "failure", error: err.message });
  }
});

module.exports = app;