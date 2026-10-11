#!/usr/bin/env node
// Синтетический снимок для разработки и тестов: node tools/make-fixture.mjs [--out data/fixture/snapshot.json]
//
// ВНИМАНИЕ: все числа, названия организаций, журналов и публикаций здесь выдуманы. Снимок нужен,
// чтобы собирать и проверять сайт без доступа к OpenAlex; сборка из него помечает каждую страницу
// плашкой «Демонстрационные данные», а публикация такой сборки в GitHub Pages запрещена (tools/check.mjs).

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { COMPETENCIES } from '../content/competencies.mjs';
import { assignTopics, topicSetKey } from '../src/lib/classify.mjs';
import { INSTITUTION, WORK_TYPES, THRESHOLDS, STRATEGY } from '../config/site.mjs';
import { PRIORITIES } from '../content/priorities.mjs';
import { buildModel } from '../src/lib/metrics.mjs';
import { openingCandidates } from '../src/lib/strategy.mjs';

const outFile = path.resolve(process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : 'data/fixture/snapshot.json');

// Детерминированный генератор случайных чисел (mulberry32): снимок одинаков при каждом запуске.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(20261001);
const pick = (list) => list[Math.floor(rand() * list.length)];
const normal = () => Math.sqrt(-2 * Math.log(rand() || 1e-9)) * Math.cos(2 * Math.PI * rand());
const lognormal = (mu, sigma) => Math.exp(mu + sigma * normal());
function weighted(entries) {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [v, w] of entries) {
    r -= w;
    if (r <= 0) return v;
  }
  return entries[entries.length - 1][0];
}

const period = { from: 2016, to: 2025, p1: [2016, 2020], p2: [2021, 2025] };
const YEARS = Array.from({ length: 10 }, (_, i) => 2016 + i);

// [подобласть, название темы, мировой объём за первый период, рост ко второму, вес у университета]
const TOPICS = [
  [2209, 'Advanced Machining and Optimization Techniques', 21000, 1.35, 60],
  [2209, 'Additive Manufacturing and 3D Printing Technologies', 16000, 2.3, 34],
  [2209, 'Manufacturing Process and Optimization', 26000, 1.25, 26],
  [2209, 'Flexible and Reconfigurable Manufacturing Systems', 9000, 1.3, 12],
  [2209, 'Scheduling and Optimization Algorithms', 24000, 1.4, 4],
  [2209, 'Digital Transformation in Industry', 7000, 3.1, 24],
  [2209, 'Advanced Surface Polishing Techniques', 7500, 1.3, 14],
  [2209, 'Erosion and Abrasive Machining', 6000, 1.15, 10],
  [2209, 'Electrical Discharge Machining Processes', 5200, 1.2, 38],
  [2209, 'Injection Molding Process and Properties', 6400, 1.1, 1],
  [2209, 'Product Development and Customization', 11000, 1.2, 6],
  [2209, 'Quality and Supply Management', 9500, 1.15, 5],
  [2210, 'Tribology and Wear Analysis', 14000, 1.4, 40],
  [2210, 'Gear and Bearing Dynamics Analysis', 15000, 1.5, 10],
  [2210, 'Machine Fault Diagnosis Techniques', 18000, 1.9, 9],
  [2210, 'Mechanical Engineering and Vibrations Research', 8000, 1.1, 22],
  [2210, 'Hydraulic and Pneumatic Systems', 9000, 1.3, 8],
  [2210, 'Welding Techniques and Residual Stresses', 12000, 1.2, 4],
  [2210, 'Metal Forming Simulation Techniques', 10000, 1.15, 6],
  [2210, 'Heat Transfer and Optimization', 30000, 1.6, 2],
  [2210, 'Lubricants and Their Additives', 7000, 1.3, 4],
  [2211, 'Metal and Thin Film Mechanics', 17000, 1.2, 54],
  [2211, 'Fatigue and Fracture Mechanics', 22000, 1.3, 6],
  [2211, 'Composite Structure Analysis and Optimization', 20000, 1.35, 3],
  [2211, 'Elasticity and Material Modeling', 15000, 1.1, 8],
  [2207, 'Iterative Learning Control Systems', 9000, 1.2, 3],
  [2207, 'Adaptive Control of Nonlinear Systems', 26000, 1.25, 4],
  [2207, 'Industrial Technology and Control Systems', 6000, 1.6, 28],
  [2207, 'Robotic Mechanisms and Dynamics', 14000, 1.45, 18],
  [2207, 'Robot Manipulation and Learning', 12000, 2.1, 8],
  [2207, 'Teleoperation and Haptic Systems', 6000, 1.3, 2],
  [2208, 'Electric Motor Design and Analysis', 15000, 1.4, 5],
  [2208, 'Sensorless Control of Electric Motors', 11000, 1.3, 4],
  [2208, 'Power Systems and Renewable Energy', 40000, 1.5, 1],
  [2208, 'Antenna Design and Analysis', 30000, 1.2, 0.5],
  [2204, '3D Printing in Biomedical Research', 9000, 2.0, 4],
  [2205, 'Structural Health Monitoring Techniques', 16000, 1.5, 1],
  [2205, 'Concrete and Cement Materials Research', 45000, 1.6, 0.3],
  [2202, 'Spacecraft Dynamics and Control', 9000, 1.2, 0.5],
  [2203, 'Vehicle Dynamics and Control Systems', 14000, 1.3, 0.5],
  [2213, 'Reliability and Maintenance Optimization', 12000, 1.3, 4],
  [2206, 'Topology Optimization in Engineering', 9000, 1.5, 1],
  [2505, 'Advanced materials and composites', 20000, 1.3, 24],
  [2505, 'Additive Manufacturing Materials and Processes', 12000, 2.2, 22],
  [2505, 'Graphene research and applications', 40000, 1.1, 3],
  [2505, 'Nanomaterials for catalytic reactions', 35000, 1.4, 0.3],
  [2506, 'Titanium Alloys Microstructure and Properties', 15000, 1.3, 10],
  [2506, 'Aluminum Alloys Composites Properties', 13000, 1.25, 6],
  [2506, 'High Entropy Alloys Studies', 6000, 2.6, 6],
  [2506, 'Microstructure and Mechanical Properties of Steels', 18000, 1.2, 8],
  [2506, 'Hydrogen embrittlement and corrosion behaviors in metals', 7000, 1.4, 2],
  [2506, 'Metallurgy and Material Forming', 11000, 1.1, 10],
  [2506, 'Shape Memory Alloy Transformations', 8000, 1.1, 2],
  [2503, 'Advanced ceramic materials synthesis', 12000, 1.25, 40],
  [2503, 'Mechanical Behavior of Composites', 18000, 1.35, 6],
  [2503, 'Diamond and Carbon-based Materials Research', 9000, 1.1, 14],
  [2503, 'MXene and MAX Phase Materials', 4000, 3.4, 0],
  [2503, 'Glass properties and applications', 10000, 1.1, 1],
  [2508, 'High-Temperature Coating Behaviors', 9000, 1.3, 26],
  [2508, 'Corrosion Behavior and Inhibition', 20000, 1.3, 5],
  [2508, 'Electrodeposition and Electroless Coatings', 9000, 1.2, 3],
  [2508, 'Anodic Oxide Films and Nanostructures', 7000, 1.1, 4],
  [2508, 'Surface Treatment and Residual Stress', 6000, 1.3, 12],
  [2502, 'Bone Tissue Engineering Materials', 22000, 1.4, 6],
  [2502, 'Titanium Implant Surface Modification', 5000, 1.4, 5],
  [2504, 'Magnetic properties of thin films', 15000, 1.0, 0.5],
  [2504, 'Ferroelectric and Piezoelectric Materials', 16000, 1.2, 1],
  [2504, 'Perovskite Materials and Applications', 18000, 2.2, 0],
  [2507, 'Polymer composites and self-healing', 9000, 1.6, 1],
  [3104, 'Ion-surface interactions and analysis', 8000, 1.0, 16],
  [3104, 'Plasma Diagnostics and Applications', 9000, 1.1, 20],
  [3104, 'Metallic Glasses and Amorphous Alloys', 6000, 1.1, 2],
  [3104, 'Physics of Superconductivity and Magnetism', 25000, 1.0, 0.5],
  [3107, 'Laser Material Processing Techniques', 12000, 1.5, 22],
  [3107, 'Laser-induced spectroscopy and plasma', 7000, 1.2, 3],
  [3107, 'Optical measurement and interference techniques', 14000, 1.3, 10],
  [3107, 'Advanced Fiber Laser Technologies', 15000, 1.2, 1],
  [3107, 'Laser-Plasma Interactions and Diagnostics', 8000, 1.1, 0.5],
  [3105, 'Advanced Measurement and Metrology Techniques', 9000, 1.3, 14],
  [3105, 'Calibration and Measurement Techniques', 7000, 1.2, 6],
  [3106, 'Particle physics theoretical and experimental studies', 30000, 1.0, 0.2],
  [3103, 'Astrophysics and Star Formation Studies', 25000, 1.1, 0.1],
  [1702, 'Neural Networks and Applications', 30000, 1.9, 10],
  [1702, 'Explainable Artificial Intelligence (XAI)', 6000, 4.0, 0],
  [1702, 'Evolutionary Algorithms and Applications', 15000, 1.4, 3],
  [1702, 'Natural Language Processing Techniques', 30000, 2.6, 0],
  [1702, 'Fuzzy Logic and Control Systems', 11000, 1.1, 3],
  [1707, 'Industrial Vision Systems and Defect Detection', 8000, 2.4, 6],
  [1707, 'Advanced Image and Video Retrieval Techniques', 20000, 1.4, 1],
  [1705, 'IoT and Edge/Fog Computing', 24000, 2.0, 6],
  [1705, 'Network Security and Intrusion Detection', 26000, 1.8, 1],
  [1706, 'Simulation and Modeling Applications', 12000, 1.2, 10],
  [1706, 'Big Data and Business Intelligence', 14000, 1.5, 3],
  [1712, 'Software Engineering Research', 18000, 1.2, 6],
  [1710, 'Information Systems Theories and Implementation', 9000, 1.3, 4],
  [2604, 'Advanced Mathematical Modeling in Engineering', 9000, 1.3, 26],
  [2604, 'Fractional Differential Equations Solutions', 14000, 1.6, 6],
  [2604, 'Numerical methods for differential equations', 16000, 1.2, 12],
  [2603, 'Advanced Mathematical Theories and Applications', 10000, 1.1, 8],
  [2613, 'Statistical Methods and Inference', 22000, 1.2, 2],
  [2611, 'Simulation Techniques and Applications', 9000, 1.2, 4],
  [1603, 'Electrochemical Analysis and Applications', 20000, 1.3, 1],
  [1605, 'Catalytic C-H Functionalization Methods', 15000, 1.1, 0.1],
  [1508, 'Membrane Separation Technologies', 16000, 1.3, 0.3],
  [2105, 'Hydrogen Storage and Materials', 12000, 1.4, 1],
  [2102, 'Advanced Battery Technologies Research', 30000, 1.9, 0],
  [2102, 'Wind Turbine Control Systems', 12000, 1.3, 0.5],
  [2307, 'Air Quality and Health Impacts', 26000, 1.4, 0.2],
  [1909, 'Drilling and Well Engineering', 8000, 1.1, 0.5],
  [3304, 'Engineering Education and Curriculum Development', 12000, 1.4, 22],
  [3304, 'Educational Technology and Assessment', 18000, 1.6, 8],
  [3304, 'Higher Education Learning Practices', 20000, 1.3, 6],
  [3320, 'Russia and Soviet political economy', 4000, 1.1, 2],
  [1408, 'Innovation and Socioeconomic Development', 9000, 1.5, 14],
  [1408, 'Corporate Management and Innovation', 14000, 1.3, 6],
  [1407, 'Human Resource Management Practices', 15000, 1.3, 3],
  [2002, 'Economic and Technological Developments in Russia', 5000, 1.4, 16],
  [2002, 'Regional Economic Development and Innovation', 12000, 1.3, 5],
  [1803, 'Supply Chain and Logistics Optimization', 20000, 1.5, 3],
  [2746, 'Orthopaedic implants and arthroplasty', 30000, 1.3, 0.3],
  [2730, 'Cancer Immunotherapy Research', 50000, 1.6, 0.05],
  [2725, 'COVID-19 Clinical Research', 2000, 30, 0],
  [1312, 'Protein Structure and Dynamics', 30000, 1.1, 0.05],
  [1202, 'History of Science and Technology', 6000, 1.0, 0.5],
  // Быстрорастущие темы, где у университета нет работ, — для раздела «Что открыть с нуля».
  [2209, 'Digital Twin Technologies in Manufacturing', 3500, 3.4, 0],
  [2209, 'Wire Arc Additive Manufacturing', 2600, 3.0, 0],
  [2211, 'High-Entropy Alloys and Their Properties', 5000, 2.6, 0],
  [2210, 'Remaining Useful Life Prediction', 3000, 2.8, 0],
  [2503, 'Ceramic Matrix Composites for Extreme Environments', 3200, 2.0, 0],
  [1702, 'Large Language Models in Engineering', 1500, 9.0, 0],
  [2207, 'Collaborative Robots and Human-Robot Interaction', 4200, 2.2, 0],
  [2502, 'Bioresorbable Metallic Implants', 2800, 1.9, 0],
  [3304, 'Online and Blended Engineering Education', 6000, 1.6, 0],
  [2212, 'Wave Energy Converter Numerical Simulation', 2400, 2.3, 0],
  [3107, 'Quantum Metrology and Sensing', 3200, 2.4, 0],
];

const FIELD_NAMES = {
  12: 'Arts and Humanities', 13: 'Biochemistry, Genetics and Molecular Biology', 14: 'Business, Management and Accounting',
  15: 'Chemical Engineering', 16: 'Chemistry', 17: 'Computer Science', 18: 'Decision Sciences', 19: 'Earth and Planetary Sciences',
  20: 'Economics, Econometrics and Finance', 21: 'Energy', 22: 'Engineering', 23: 'Environmental Science', 25: 'Materials Science',
  26: 'Mathematics', 27: 'Medicine', 31: 'Physics and Astronomy', 33: 'Social Sciences',
};
const DOMAIN_OF_FIELD = { 12: 2, 13: 1, 14: 2, 15: 3, 16: 3, 17: 3, 18: 2, 19: 3, 20: 2, 21: 3, 22: 3, 23: 3, 25: 3, 26: 3, 27: 4, 31: 3, 33: 2 };
const DOMAIN_NAMES = { 1: 'Life Sciences', 2: 'Social Sciences', 3: 'Physical Sciences', 4: 'Health Sciences' };

const topics = TOPICS.map(([subfield, name], i) => {
  const field = Math.floor(subfield / 100);
  return { id: `T${10001 + i}`, name, subfield, field, domain: DOMAIN_OF_FIELD[field] };
});
const subfieldNames = {};
for (const [subfield, name] of TOPICS) subfieldNames[subfield] ??= `Subfield ${subfield} (${name.split(' ')[0]})`;

// Мировой поток: объём первого периода, рост ко второму, распределение по годам.
const worldTopics = {};
const worldByYear = Object.fromEntries(YEARS.map((y) => [y, 0]));
TOPICS.forEach(([, , p1, growth], i) => {
  const a = Math.round(p1 * (0.9 + rand() * 0.2));
  const b = Math.round(a * growth * (0.95 + rand() * 0.1));
  worldTopics[topics[i].id] = [a, b];
  for (const [part, from] of [[a, 2016], [b, 2021]]) {
    for (let k = 0; k < 5; k += 1) worldByYear[from + k] += Math.round((part / 5) * (0.9 + k * 0.05));
  }
});
for (const y of YEARS) worldByYear[y] = Math.round(worldByYear[y] * 1.04); // работы без темы

const { byTopic: competencyOf, byCompetency } = assignTopics(topics, COMPETENCIES);
const IMPACT = {
  'coatings-tribology': 0.25, 'ceramics-composites': 0.2, 'laser-edm-plasma': 0.05, 'additive-manufacturing': 0.15,
  machining: -0.05, 'metals-alloys': -0.1, 'digital-manufacturing': -0.35, 'industrial-economics': -0.9,
  'engineering-education': -1.1, 'modeling-mechanics': -0.4, 'metrology-quality': -0.45, 'ai-data': -0.3,
  robotics: -0.35, 'condition-monitoring': -0.2, 'machine-tools-control': -0.5, biomaterials: 0.1, 'forming-welding': -0.4,
};

// Выдуманные партнёры, журналы и организации.
const PARTNER_COUNTRIES = [['ES', 9], ['DE', 4], ['CN', 4], ['IN', 4], ['BY', 3], ['KZ', 3], ['UZ', 3], ['IT', 2], ['FR', 2],
  ['SA', 2], ['GB', 1.5], ['US', 1.5], ['IQ', 1.5], ['EG', 1.2], ['PL', 1], ['CZ', 1], ['RS', 0.8], ['VN', 0.8], ['AE', 0.8],
  ['AZ', 0.8], ['AM', 0.6], ['KR', 0.6], ['JP', 0.5], ['TJ', 0.5]];
const CITY = ['Northern', 'Southern', 'Central', 'Eastern', 'Western', 'Coastal', 'Highland', 'Riverside', 'Lakeside', 'Valley'];
const KIND = ['Technical University', 'Polytechnic University', 'Institute of Technology', 'University', 'Institute of Materials Research', 'Research Centre for Manufacturing'];
const institutions = {};
let instSeq = 9000001;
function makeInstitution(country, type = 'education') {
  const id = `I${instSeq++}`;
  const name = type === 'company'
    ? `${pick(CITY)} Machine-Tool Works (demo)`
    : `${pick(CITY)} ${pick(KIND)} (demo, ${country})`;
  institutions[id] = { name, country, type, ror: null };
  return id;
}
const ownId = INSTITUTION.openalexId;
institutions[ownId] = { name: 'Moscow State University of Technology', country: 'RU', type: 'education', ror: INSTITUTION.ror };
const homePartners = Array.from({ length: 30 }, (_, i) => makeInstitution('RU', i % 9 === 4 ? 'company' : i % 7 === 3 ? 'facility' : 'education'));
const foreignPartners = Object.fromEntries(PARTNER_COUNTRIES.map(([c]) => [c, Array.from({ length: 3 }, () => makeInstitution(c))]));

const SOURCE_NAMES = [
  ['Demo Journal of Materials Processing', 'journal'], ['Demo Coatings and Surfaces', 'journal'], ['Demo Bulletin of Machine Science', 'journal'],
  ['Proceedings of the Demo Conference on Industrial Engineering', 'conference'], ['Demo Letters in Ceramics', 'journal'],
  ['Demo Journal of Physics: Conference Series', 'conference'], ['Demo Technologies', 'journal'], ['Demo Mathematics', 'journal'],
  ['Demo Russian Engineering Research', 'journal'], ['Demo Lecture Notes in Mechanical Engineering', 'book series'],
  ['Demo Metals', 'journal'], ['Demo Applied Sciences', 'journal'], ['Demo Wear', 'journal'], ['Demo Machines', 'journal'],
  ['Demo Journal of Manufacturing Processes', 'journal'], ['Demo Vestnik of Technology', 'journal'], ['Demo Procedia CIRP', 'conference'],
];
const sources = {};
const sourceIds = SOURCE_NAMES.map(([name, type], i) => {
  const id = `S${700001 + i}`;
  sources[id] = { name, type, publisher: 'Demo Publisher', issn: null };
  return id;
});
const sourceWeights = sourceIds.map((id, i) => [id, 30 / (i + 2)]);

// Публикации университета.
const topicWeights = TOPICS.map(([, , , , w], i) => [topics[i].id, w]);
const works = [];
let wseq = 4000000001;
const LAST_NAMES = ['Ivanov', 'Petrova', 'Smirnov', 'Kuznetsova', 'Sokolov', 'Popova', 'Lebedev', 'Kozlova', 'Novikov', 'Morozova', 'Volkov', 'Fedorova'];
for (const year of YEARS) {
  const count = Math.round(260 + (year - 2016) * 34 + normal() * 12);
  for (let k = 0; k < count; k += 1) {
    const tp = rand() < 0.04 ? null : weighted(topicWeights);
    const comp = tp ? competencyOf.get(tp) : null;
    const mu = (IMPACT[comp] ?? -0.6) - 0.35;
    const age = 2026 - year;
    const fw = rand() < 0.06 ? null : Math.round(lognormal(mu, 1.0) * 1000) / 1000;
    const cites = fw == null ? Math.floor(rand() * 4) : Math.round(fw * (2 + age * 2.5) * (0.6 + rand() * 0.8));
    // Процентиль растёт с FWCI: около 0,7 при FWCI = 1 и выше 0,9 при FWCI > 2,5.
    const pct = fw == null ? null : Math.min(0.999, Math.max(0, 1 - 1 / (1 + (fw / 0.6) ** 1.6) + normal() * 0.04));
    const intl = rand() < 0.2 + (year - 2016) * 0.008;
    const co = new Set(['RU']);
    const ins = new Set([ownId]);
    if (intl) {
      const c = weighted(PARTNER_COUNTRIES);
      co.add(c);
      ins.add(pick(foreignPartners[c]));
      if (rand() < 0.15) {
        const c2 = weighted(PARTNER_COUNTRIES);
        co.add(c2);
        ins.add(pick(foreignPartners[c2]));
      }
    }
    if (rand() < 0.35) ins.add(pick(homePartners));
    const na = 1 + Math.floor(rand() * 6) + (intl ? 2 : 0);
    const authors = Array.from({ length: Math.min(3, na) }, () => `${String.fromCharCode(65 + Math.floor(rand() * 26))}. ${pick(LAST_NAMES)}`);
    const topicName = tp ? topics.find((t) => t.id === tp).name : 'unclassified research';
    const type = weighted([['article', 76], ['book-chapter', 16], ['review', 8]]);
    works.push({
      id: `W${wseq++}`,
      doi: `10.5555/demo.${year}.${k + 1}`,
      t: `Demo publication ${k + 1} (${year}) on ${topicName.toLowerCase()}`,
      y: year,
      ty: type,
      tp,
      fw,
      c: cites,
      p: pct == null ? null : Math.round(pct * 1000) / 1000,
      t10: pct != null && pct >= 0.9 ? 1 : 0,
      t1: pct != null && pct >= 0.99 ? 1 : 0,
      co: [...co].sort(),
      in: [...ins].sort(),
      s: rand() < 0.03 ? null : weighted(sourceWeights),
      oa: rand() < 0.45 ? 1 : 0,
      lang: rand() < 0.78 ? 'en' : 'ru',
      a: authors,
      na,
      lead: rand() < 0.7 ? 1 : 0,
    });
  }
}

// Мировой контекст компетенций.
const WORLD_COUNTRIES = [['CN', 30], ['US', 11], ['IN', 9], ['DE', 5], ['KR', 4], ['JP', 4], ['IR', 3.5], ['GB', 3.5], ['IT', 3.2],
  ['FR', 2.8], ['RU', 2.4], ['BR', 2.2], ['CA', 2], ['ES', 2], ['PL', 1.8], ['TR', 1.7], ['AU', 1.6], ['SA', 1.2], ['CZ', 0.8], ['EG', 0.8]];
const competencies = {};
for (const c of COMPETENCIES) {
  const ids = byCompetency.get(c.id) ?? [];
  const own = works.filter((w) => ids.includes(w.tp));
  if (own.length < 15) continue;
  const total = ids.reduce((s, id) => s + worldTopics[id][0] + worldTopics[id][1], 0);
  const worldByYearC = {};
  for (const y of YEARS) {
    const share = y <= 2020 ? 0.2 * (0.9 + (y - 2016) * 0.05) : 0.2 * (0.9 + (y - 2021) * 0.05);
    const part = ids.reduce((s, id) => s + (y <= 2020 ? worldTopics[id][0] : worldTopics[id][1]), 0);
    worldByYearC[y] = Math.round(part * share);
  }
  const countryList = WORLD_COUNTRIES.map(([code, w]) => ({ code, name: code, n: Math.round((total * w) / 100 * (0.8 + rand() * 0.4)) }))
    .sort((a, b) => b.n - a.n);
  const ownN = own.length;
  const scale = 1.5 + rand() * 5;
  const instList = Array.from({ length: 60 }, (_, i) => {
    const country = weighted(WORLD_COUNTRIES);
    const id = makeInstitution(country);
    return { id, name: institutions[id].name, n: Math.round(ownN * scale * (i + 1) ** -0.6 * (0.9 + rand() * 0.2)) };
  });
  instList.push({ id: ownId, name: institutions[ownId].name, n: ownN });
  instList.sort((a, b) => b.n - a.n);
  const ruScale = 0.6 + rand() * 2.2;
  const ruList = Array.from({ length: 14 }, (_, i) => {
    const id = homePartners[i % homePartners.length];
    return { id, name: institutions[id].name, n: Math.round(ownN * ruScale * (i + 1) ** -0.5 * (0.9 + rand() * 0.2)) };
  });
  ruList.push({ id: ownId, name: institutions[ownId].name, n: ownN });
  ruList.push({ id: foreignPartners.ES[0], name: institutions[foreignPartners.ES[0]].name, n: Math.round(ownN * 0.3) });
  ruList.sort((a, b) => b.n - a.n);
  competencies[c.id] = {
    topicKey: topicSetKey(ids),
    worldByYear: worldByYearC,
    countries: countryList,
    institutions: instList,
    russianInstitutions: ruList,
    reviews: Array.from({ length: 5 }, (_, i) => ({
      id: `W${wseq++}`,
      doi: `10.5555/demo.review.${c.id}.${i + 1}`,
      t: `Demo review ${i + 1}: recent advances in ${c.name.en.toLowerCase()}`,
      y: 2021 + (i % 4),
      c: Math.round(1200 / (i + 1)),
      src: 'Demo Progress in Engineering Science',
      a: ['A. Reviewer', 'B. Author', 'C. Expert'],
      na: 4 + i,
    })),
  };
}

const snapshot = {
  schema: 1,
  source: 'fixture',
  fetchedAt: '2026-10-01T00:00:00.000Z',
  config: {
    period,
    types: WORK_TYPES,
    institutionIds: [ownId],
    institutionGroupKey: 'authorships.institutions.id',
    excludedInstitutionTypes: ['government', 'funder'],
  },
  api: null,
  institution: {
    id: ownId,
    ids: [ownId],
    name: 'Moscow State University of Technology',
    ror: INSTITUTION.ror,
    country: 'RU',
    type: 'education',
    homepage: 'https://stankin.ru/',
    worksCount: null,
    citedByCount: null,
    candidates: [],
  },
  taxonomy: {
    topics,
    subfields: subfieldNames,
    fields: Object.fromEntries(Object.entries(FIELD_NAMES).map(([k, v]) => [k, v])),
    domains: DOMAIN_NAMES,
  },
  world: {
    byYear: worldByYear,
    periodTotals: [
      YEARS.filter((y) => y <= 2020).reduce((s, y) => s + worldByYear[y], 0),
      YEARS.filter((y) => y > 2020).reduce((s, y) => s + worldByYear[y], 0),
    ],
    topics: worldTopics,
  },
  stankin: { works, sources },
  competencies,
  institutions,
  warnings: ['Демонстрационный снимок: все числа и названия выдуманы.'],
};

// Контекст тем «открыть с нуля» — для тех же кандидатов, что выбирает настоящая выгрузка.
{
  const draft = buildModel(snapshot, { competencies: COMPETENCIES, thresholds: THRESHOLDS, home: 'RU' });
  const opportunities = {};
  for (const id of openingCandidates(draft, { config: STRATEGY, priorities: PRIORITIES })) {
    const total = worldTopics[id][0] + worldTopics[id][1];
    const insts = Array.from({ length: 30 }, (_, i) => {
      const country = weighted(WORLD_COUNTRIES);
      const iid = i % 11 === 5 ? pick(foreignPartners[weighted(PARTNER_COUNTRIES)]) : makeInstitution(country);
      return { id: iid, name: institutions[iid].name, n: Math.round((total / 60) * (i + 1) ** -0.7) + 1 };
    });
    const ru = Array.from({ length: 8 }, (_, i) => {
      const iid = rand() < 0.5 ? pick(homePartners) : makeInstitution('RU');
      return { id: iid, name: institutions[iid].name, n: Math.max(1, Math.round((total / 900) * (i + 1) ** -0.6)) };
    }).sort((a, b) => b.n - a.n);
    opportunities[id] = {
      countries: WORLD_COUNTRIES.slice(0, 12).map(([code, w]) => ({ code, name: code, n: Math.round((total * w) / 100 * (0.7 + rand() * 0.6)) })).sort((a, b) => b.n - a.n),
      institutions: insts.sort((a, b) => b.n - a.n),
      russianInstitutions: [...new Map(ru.map((g) => [g.id, g])).values()],
      reviews: Array.from({ length: 3 }, (_, i) => ({
        id: `W${wseq++}`,
        doi: `10.5555/demo.review.${id}.${i + 1}`,
        t: `Demo review ${i + 1}: state of the art in ${topics.find((t) => t.id === id).name.toLowerCase()}`,
        y: 2022 + i,
        c: Math.round(600 / (i + 1)),
        src: 'Demo Progress in Engineering Science',
        a: ['A. Reviewer', 'B. Author'],
        na: 3 + i,
      })),
    };
  }
  snapshot.opportunities = opportunities;
}

await mkdir(path.dirname(outFile), { recursive: true });
await writeFile(outFile, `${JSON.stringify(snapshot)}\n`);
console.log(`Синтетический снимок: ${outFile} · тем ${topics.length}, работ ${works.length}, компетенций с контекстом ${Object.keys(competencies).length}`);
