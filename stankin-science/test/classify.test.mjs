import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assignTopics, topicMatches, topicSetKey } from '../src/lib/classify.mjs';
import { COMPETENCIES } from '../content/competencies.mjs';

// Названия и коды тем в духе классификации OpenAlex: [подобласть, название, ожидаемая компетенция или null]
const CASES = [
  [2209, 'Electrical Discharge Machining Processes', 'laser-edm-plasma'],
  [2209, 'Advanced Machining and Optimization Techniques', 'machining'],
  [2209, 'Advanced Surface Polishing Techniques', 'machining'],
  [2209, 'Additive Manufacturing and 3D Printing Technologies', 'additive-manufacturing'],
  [2505, 'Additive Manufacturing Materials and Processes', 'additive-manufacturing'],
  [2210, 'Tribology and Wear Analysis', 'coatings-tribology'],
  [2211, 'Metal and Thin Film Mechanics', 'coatings-tribology'],
  [2508, 'Electrodeposition and Electroless Coatings', 'coatings-tribology'],
  [2508, 'Anodic Oxide Films and Nanostructures', 'coatings-tribology'],
  [2503, 'Advanced ceramic materials synthesis', 'ceramics-composites'],
  [2503, 'Diamond and Carbon-based Materials Research', 'ceramics-composites'],
  [2506, 'Titanium Alloys Microstructure and Properties', 'metals-alloys'],
  [2502, 'Bone Tissue Engineering Materials', 'biomaterials'],
  [2207, 'Robotic Mechanisms and Dynamics', 'robotics'],
  [2210, 'Machine Fault Diagnosis Techniques', 'condition-monitoring'],
  [2210, 'Gear and Bearing Dynamics Analysis', 'machine-tools-control'],
  [2210, 'Hydraulic and Pneumatic Systems', 'machine-tools-control'],
  [3107, 'Laser Material Processing Techniques', 'laser-edm-plasma'],
  [3104, 'Plasma Diagnostics and Applications', 'laser-edm-plasma'],
  [3105, 'Advanced Measurement and Metrology Techniques', 'metrology-quality'],
  [1702, 'Neural Networks and Applications', 'ai-data'],
  [1712, 'Software Engineering Research', 'software-it'],
  [2209, 'Digital Transformation in Industry', 'digital-manufacturing'],
  [2604, 'Fractional Differential Equations Solutions', 'modeling-mechanics'],
  [2002, 'Economic and Technological Developments in Russia', 'industrial-economics'],
  [3304, 'Engineering Education and Curriculum Development', 'engineering-education'],
  [2210, 'Welding Techniques and Residual Stresses', 'forming-welding'],
  // не наши области — вне компетенций
  [3107, 'Laser-induced spectroscopy and plasma', null],
  [3107, 'Advanced Fiber Laser Technologies', null],
  [2205, 'Concrete and Cement Materials Research', null],
  [2730, 'Cancer Immunotherapy Research', null],
  [3106, 'Laser-Plasma Interactions and Diagnostics', null],
  [1909, 'Drilling and Well Engineering', null],
];

const topics = CASES.map(([subfield, name], i) => ({ id: `T${10001 + i}`, name, subfield, field: Math.floor(subfield / 100), domain: 3 }));

test('темы относятся к ожидаемым компетенциям', () => {
  const { byTopic } = assignTopics(topics, COMPETENCIES);
  CASES.forEach(([, name, expected], i) => {
    assert.equal(byTopic.get(topics[i].id) ?? null, expected, name);
  });
});

test('у компетенций уникальные идентификаторы и полные тексты на двух языках', () => {
  const ids = COMPETENCIES.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const c of COMPETENCIES) {
    assert.match(c.id, /^[a-z0-9-]+$/);
    for (const key of ['name', 'short', 'summary']) {
      assert.ok(c[key].ru && c[key].en, `${c.id}.${key}`);
    }
    assert.ok(c.short.ru.length <= 30, `короткое название ${c.id} длиннее 30 знаков`);
  }
});

test('исключение сильнее включения целиком', () => {
  const rule = { whole: { fields: [22] }, exclude: /concrete/i };
  assert.equal(topicMatches(rule, { name: 'Concrete durability', field: 22, subfield: 2205 }), false);
  assert.equal(topicMatches(rule, { name: 'Steel bridges', field: 22, subfield: 2205 }), true);
});

test('отпечаток набора тем не зависит от порядка', () => {
  assert.equal(topicSetKey(['T2', 'T1', 'T3']), topicSetKey(['T3', 'T2', 'T1']));
  assert.notEqual(topicSetKey(['T1', 'T2']), topicSetKey(['T1', 'T3']));
});
