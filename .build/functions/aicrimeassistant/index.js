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

const CRIME_TYPES = ["Theft", "Assault", "Robbery", "Cheating", "Kidnapping", "Criminal Intimidation"];
const CRIME_SYNONYMS = {
  "Theft": ["theft", "thefts", "stolen", "steal", "steals", "stealing", "burglary", "burglaries"],
  "Assault": ["assault", "assaults", "attack", "attacked", "beaten", "beating"],
  "Robbery": ["robbery", "robberies", "robbed", "snatching", "snatch", "mugging", "mugged"],
  "Cheating": ["cheating", "cheat", "fraud", "frauds", "scam", "scams"],
  "Kidnapping": ["kidnapping", "kidnap", "kidnapped", "abduction", "abducted"],
  "Criminal Intimidation": ["intimidation", "intimidating", "threat", "threats", "threatening"]
};
const DISTRICTS = ["Bengaluru City", "Bengaluru Rural", "Mysuru", "Belagavi", "Dharwad", "Tumakuru"];
const DISTRICT_SYNONYMS = {
  "Bengaluru City": ["bengaluru city", "bangalore city", "bengaluru urban", "bengaluru", "bangalore"],
  "Bengaluru Rural": ["bengaluru rural", "bangalore rural"],
  "Mysuru": ["mysuru", "mysore"],
  "Belagavi": ["belagavi", "belgaum"],
  "Dharwad": ["dharwad", "hubli", "hubballi"],
  "Tumakuru": ["tumakuru", "tumkur"]
};
const STATUS_MAP = {
  "Under Investigation": ["pending", "under investigation", "investigation", "ongoing", "open"],
  "Charge Sheet Filed": ["charge sheet", "chargesheet", "charge-sheet", "filed"],
  "Final Report": ["final report"],
  "Closed": ["closed", "close cases", "resolved"]
};
const UNSUPPORTED_SIGNALS = [
  "ipl", "cricket", "match day", "tournament", "world cup", "f1", "formula 1",
  "movie", "film", "festival", "poll", "weather", "rain", "temperature",
  "joke", "concert", "holiday", "diwali", "holi", "new year",
  "independence day", "republic day"
];

// Out-of-scope categories the assistant should decline, each with its own reason.
// Order matters: privacy/bias checks run first since they're the most important to catch reliably.
const REFUSAL_CATEGORIES = [
  {
    name: 'privacy_violation',
    patterns: [/home address/, /phone number/, /aadhaar/, /passport/, /witness (info|detail|identity)/, /confidential/, /bank (account|transaction)/, /live location/, /gps (location|tracking)/, /call records?/, /social media (profile|account)/, /cctv footage/],
    message: `I can't share private or confidential details like home addresses, phone numbers, ID numbers, or witness information — that's outside what this assistant is allowed to surface.`
  },
  {
    name: 'biased_sensitive',
    patterns: [/which (religion|caste|community)/, /religion.*(crime|criminal)/, /caste.*(crime|criminal)/, /are (men|women) more dangerous/, /community should.*(monitor|watch|target)/],
    message: `I don't provide analysis based on religion, caste, gender, or community — that kind of profiling isn't something this platform supports.`
  },
  {
    name: 'legal_judgment',
    patterns: [/should.*(be convicted|receive|punishment)/, /is (this person|the accused) innocent/, /is (this person|the accused) guilty/, /what punishment/, /should this case be closed/],
    message: `I can't make legal judgments like guilt, innocence, or sentencing — those are for the courts and investigating officers to decide. I can show you the case's recorded facts and status instead.`
  },
  {
    name: 'investigation_decision',
    patterns: [/who should (be arrested|police interrogate)/, /which suspect should/, /who committed this/, /which evidence should.*(ignore|drop)/],
    message: `Decisions about who to arrest, interrogate, or which evidence to pursue belong to the investigating officer — I can only surface recorded case data, not make those calls.`
  },
  {
    name: 'predictive_no_evidence',
    patterns: [/who will commit/, /where will the next/, /predict.*(next crime|crime location)/, /most likely to become a criminal/, /identify gang networks/, /facial recognition/],
    message: `I can't predict future crimes, specific locations, or identify individuals from imagery — that needs dedicated ML/intelligence systems this assistant doesn't have. I can show historical patterns and trends instead.`
  },
  {
    name: 'personal_opinion',
    patterns: [/worst criminal/, /do you think.*(guilty|innocent)/, /is this police station (good|bad)/, /safest (district|area|place) to live/],
    message: `I don't offer opinions or rankings like that — I can give you the underlying case counts and trends so you can draw your own conclusions.`
  },
  {
    name: 'administrative_decision',
    patterns: [/which officer should.*(promote|suspend)/, /which police station should be closed/],
    message: `Staffing and administrative decisions aren't something this assistant handles — that's outside the scope of crime case data.`
  },
  {
    name: 'unsupported_external',
    patterns: [/track.*(accused|suspect).*location/, /live cctv/, /mobile call records/, /bank transactions/, /vehicle gps/, /verify aadhaar/, /another state.?s? database/],
    message: `This assistant only covers registered crime case data — it isn't connected to CCTV, mobile records, banking systems, or other states' databases.`
  }
];

function normalize(text) {
  return text.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
}
function checkRefusal(t) {
  for (const cat of REFUSAL_CATEGORIES) {
    if (cat.patterns.some(p => p.test(t))) return cat;
  }
  return null;
}
function hasUnsupportedSignal(t) {
  return UNSUPPORTED_SIGNALS.some(sig => t.includes(sig));
}
function detectCrimeNumber(rawText) {
  const match = rawText.match(/\b\d{10,20}\b/); // long numeric crime numbers
  return match ? match[0] : null;
}
function detectCrimeType(t) {
  for (const type of CRIME_TYPES) {
    if (CRIME_SYNONYMS[type].some(syn => t.includes(syn))) return type;
  }
  return null;
}
function detectDistrict(t) {
  const ordered = [...DISTRICTS].sort((a, b) =>
    Math.max(...DISTRICT_SYNONYMS[b].map(s => s.length)) - Math.max(...DISTRICT_SYNONYMS[a].map(s => s.length))
  );
  for (const district of ordered) {
    if (DISTRICT_SYNONYMS[district].some(syn => t.includes(syn))) return district;
  }
  return null;
}
// returns ALL districts mentioned in the sentence — needed for "compare X and Y" style queries
function detectAllDistricts(t) {
  const found = [];
  for (const district of DISTRICTS) {
    if (DISTRICT_SYNONYMS[district].some(syn => t.includes(syn))) found.push(district);
  }
  return found;
}
function detectStatus(t) {
  for (const status of Object.keys(STATUS_MAP)) {
    if (STATUS_MAP[status].some(syn => t.includes(syn))) return status;
  }
  return null;
}
function detectIntent(t, hasStatus) {
  if (/trend|over time|month.?wise|monthly|pattern|graph of|timeline/.test(t)) return 'trend';
  if (/repeat|offender|habitual|recidivis/.test(t)) return 'repeat_offenders';
  if (/(top|most|which|highest).*(area|station|zone|location|place)|areas? (have|with)/.test(t)) return 'top_areas';
  // district_breakdown checked before category_breakdown — "compare across districts" is about districts, not crime types
  if (/compare|district.?wise|across districts|between districts|district breakdown/.test(t)) return 'district_breakdown';
  if (/(type|category|kind) of (case|crime)|based on (their )?type|by type|crime type distribution|all (cities|districts)/.test(t)) return 'category_breakdown';
  if (hasStatus) return 'status_filter';
  if (/how many|total|count|number of/.test(t)) return 'summary';
  return null;
}

const CLARIFICATION_TEXT = `I can only answer questions based on registered crime records — crime type (theft, robbery, assault...), district or station, dates, case status (pending, closed, charge sheet filed), crime-type breakdowns, repeat offenders, or a specific crime number. I don't have data tied to events, dates like festivals/matches, or general knowledge questions.`;

app.post('/aiCrimeAssistant', async (req, res) => {
  try {
    const rawQuery = (req.body && req.body.query) || '';
    if (!rawQuery.trim()) {
      return res.status(400).send({ status: 'failure', error: 'Missing "query" in request body' });
    }
    const t = normalize(rawQuery);

    // Gate 1: out-of-scope categories (opinions, legal judgments, predictions, privacy, bias, admin, external systems)
    const refusal = checkRefusal(t);
    if (refusal) {
      return res.status(200).send({
        status: 'success', query: rawQuery,
        detected: { crimeType: null, district: null, status: null, intent: 'refused_' + refusal.name },
        answer: refusal.message,
        data: { type: 'clarification' }
      });
    }

    // Gate 2: events/general knowledge our dataset structurally can't answer
    if (hasUnsupportedSignal(t)) {
      return res.status(200).send({
        status: 'success', query: rawQuery,
        detected: { crimeType: null, district: null, status: null, intent: 'unsupported' },
        answer: CLARIFICATION_TEXT, data: { type: 'clarification' }
      });
    }

    const catalystApp = catalyst.initialize(req);
    const zcql = catalystApp.zcql();

    // Gate 3: a specific crime number lookup takes priority over everything else
    const crimeNo = detectCrimeNumber(rawQuery);
    if (crimeNo) {
      const caseResult = await zcql.executeZCQLQuery(
        `SELECT CaseMaster.Crime_no, CaseMaster.CaseStatus, CaseMaster.CrimeGroupName, CaseMaster.District_Name, CaseMaster.PoliceStationName, CaseMaster.CrimeRegistrationDate FROM CaseMaster WHERE CaseMaster.Crime_no = '${crimeNo}' LIMIT 1`
      );
      if (caseResult.length === 0) {
        return res.status(200).send({
          status: 'success', query: rawQuery,
          detected: { crimeType: null, district: null, status: null, intent: 'crime_lookup' },
          answer: `No case found with crime number ${crimeNo}.`,
          data: { type: 'clarification' }
        });
      }
      const c = caseResult[0].CaseMaster;
      return res.status(200).send({
        status: 'success', query: rawQuery,
        detected: { crimeType: c.CrimeGroupName, district: c.District_Name, status: c.CaseStatus, intent: 'crime_lookup' },
        answer: `Crime No. ${c.Crime_no}: ${c.CrimeGroupName} case at ${c.PoliceStationName}, ${c.District_Name}. Status: ${c.CaseStatus}. Registered: ${c.CrimeRegistrationDate}.`,
        data: { type: 'clarification' }
      });
    }

    const crimeType = detectCrimeType(t);
    const district = detectDistrict(t);
    const allDistricts = detectAllDistricts(t);
    const status = detectStatus(t);
    let intent = detectIntent(t, !!status);

    if (!intent && !crimeType && !district && !status) {
      return res.status(200).send({
        status: 'success', query: rawQuery,
        detected: { crimeType: null, district: null, status: null, intent: 'unmatched' },
        answer: CLARIFICATION_TEXT, data: { type: 'clarification' }
      });
    }
    if (!intent) intent = 'summary';

    const result = await zcql.executeZCQLQuery(
      "SELECT CaseMaster.Crime_no, CaseMaster.CrimeRegistrationDate, CaseMaster.District_Name, CaseMaster.PoliceStationName, CaseMaster.CrimeGroupName, CaseMaster.CaseStatus FROM CaseMaster LIMIT 300"
    );
    let allCases = result.map(r => r.CaseMaster);
    let cases = allCases;

    if (intent !== 'category_breakdown' && intent !== 'district_breakdown') {
      if (crimeType) cases = cases.filter(c => c.CrimeGroupName === crimeType);
      if (district) cases = cases.filter(c => c.District_Name === district);
      if (status && intent === 'status_filter') cases = cases.filter(c => c.CaseStatus === status);
    } else if (intent === 'district_breakdown') {
      // never self-filter to a single district here — that would defeat the point of comparing districts.
      // only apply a crime-type filter if one was mentioned; district filtering is handled below by
      // restricting to the named districts (if 2+ were mentioned) rather than collapsing to one.
      if (crimeType) cases = cases.filter(c => c.CrimeGroupName === crimeType);
    }

    let answer = '';
    let data = {};
    const scopeText = `${crimeType || 'all crime types'}${district ? ' in ' + district : ''}`;

    if (intent === 'category_breakdown') {
      const categoryCounts = {};
      allCases.forEach(c => { categoryCounts[c.CrimeGroupName] = (categoryCounts[c.CrimeGroupName] || 0) + 1; });
      const breakdown = Object.entries(categoryCounts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
      answer = `Crime type breakdown across all districts (${allCases.length} total cases): ${breakdown.map(b => `${b.name} (${b.count})`).join(', ')}.`;
      data = { type: 'bar_chart', labels: breakdown.map(b => b.name), values: breakdown.map(b => b.count) };

    } else if (intent === 'repeat_offenders') {
      const accusedResult = await zcql.executeZCQLQuery(
        "SELECT Accused.AccusedName, Accused.CrimeNo FROM Accused LIMIT 300"
      );
      const accused = accusedResult.map(r => r.Accused);
      const nameCounts = {};
      accused.forEach(a => { nameCounts[a.AccusedName] = (nameCounts[a.AccusedName] || 0) + 1; });
      const repeatOffenders = Object.entries(nameCounts)
        .filter(([, count]) => count >= 2)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
      answer = repeatOffenders.length
        ? `Found ${repeatOffenders.length} repeat offender(s) linked to multiple cases.`
        : `No repeat offenders found in the current dataset.`;
      data = { type: 'table', columns: ['Name', 'Linked Cases'], rows: repeatOffenders.map(r => [r.name, r.count]) };

    } else if (intent === 'trend') {
      const monthly = {};
      cases.forEach(c => {
        if (!c.CrimeRegistrationDate) return;
        const key = c.CrimeRegistrationDate.split(' ')[0].slice(0, 7);
        monthly[key] = (monthly[key] || 0) + 1;
      });
      const trend = Object.entries(monthly).map(([month, count]) => ({ month, count })).sort((a, b) => a.month.localeCompare(b.month));
      answer = `Here is the month-wise trend for ${scopeText} (${cases.length} total cases).`;
      data = { type: 'line_chart', labels: trend.map(t2 => t2.month), values: trend.map(t2 => t2.count) };

    } else if (intent === 'top_areas') {
      const stationCounts = {};
      cases.forEach(c => { stationCounts[c.PoliceStationName] = (stationCounts[c.PoliceStationName] || 0) + 1; });
      const top = Object.entries(stationCounts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 5);
      answer = `Top areas for ${scopeText}: ${top.map(t2 => t2.name).join(', ') || 'no data found'}.`;
      data = { type: 'bar_chart', labels: top.map(t2 => t2.name), values: top.map(t2 => t2.count) };

    } else if (intent === 'district_breakdown') {
      const districtScopedCases = allDistricts.length >= 2
        ? cases.filter(c => allDistricts.includes(c.District_Name))
        : cases; // fewer than 2 named — show all districts, not just one
      const districtCounts = {};
      districtScopedCases.forEach(c => { districtCounts[c.District_Name] = (districtCounts[c.District_Name] || 0) + 1; });
      // if specific districts were named, keep them all present in the chart even at 0
      if (allDistricts.length >= 2) {
        allDistricts.forEach(d => { if (!(d in districtCounts)) districtCounts[d] = 0; });
      }
      const breakdown = Object.entries(districtCounts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
      answer = `District-wise breakdown for ${crimeType || 'all crimes'}${allDistricts.length >= 2 ? ' — comparing ' + allDistricts.join(' and ') : ''}: ${breakdown.map(b => `${b.name} (${b.count})`).join(', ') || 'no data found'}.`;
      data = { type: 'bar_chart', labels: breakdown.map(b => b.name), values: breakdown.map(b => b.count) };

    } else if (intent === 'status_filter') {
      answer = `Found ${cases.length} case(s) with status "${status}" for ${scopeText}.`;
      data = { type: 'summary', totalCases: cases.length, statusBreakdown: { [status]: cases.length } };

    } else {
      const statusCounts = {};
      cases.forEach(c => { statusCounts[c.CaseStatus] = (statusCounts[c.CaseStatus] || 0) + 1; });
      answer = `Found ${cases.length} case(s) for ${scopeText}.`;
      data = { type: 'summary', totalCases: cases.length, statusBreakdown: statusCounts };
    }

    res.status(200).send({
      status: 'success',
      query: rawQuery,
      detected: { crimeType, district, status, intent },
      answer,
      data
    });
  } catch (err) {
    console.error(err);
    res.status(500).send({ status: 'failure', error: err.message });
  }
});

module.exports = app;