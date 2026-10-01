// Компетенции — тематические группы, по которым строится профиль университета.
//
// Каждая компетенция собирается из тем классификации OpenAlex (≈4500 тем). Тема относится
// к первой компетенции списка, правило которой ей подходит, поэтому порядок важен:
// узкие группы (биоматериалы, аддитивные технологии, диагностика) стоят раньше широких.
//
// Правило:
//   whole   — подобласти (subfields) и области (fields), которые входят целиком;
//   scope   — области/подобласти, в которых ищутся темы по названию;
//   name    — регулярное выражение для английского названия темы;
//   exclude — темы с такими словами в названии не входят, даже если подошли по name или whole.
// Коды областей и подобластей — коды ASJC, как в OpenAlex (22 — Engineering, 2209 — Industrial
// and Manufacturing Engineering и т. д.; см. content/taxonomy.mjs).
//
// После выгрузки данных сборка печатает в журнал, какие темы попали в каждую компетенцию
// и какие темы университета остались вне компетенций, — по этому списку правила удобно уточнять.
// Полный список тем каждой компетенции публикуется на странице «Методика».

const PHYSICAL = [15, 16, 22, 25, 31]; // химическая технология, химия, инженерия, материаловедение, физика

export const COMPETENCIES = [
  {
    id: 'biomaterials',
    name: { ru: 'Биоматериалы и медицинская инженерия', en: 'Biomaterials and medical engineering' },
    short: { ru: 'Биоматериалы', en: 'Biomaterials' },
    summary: {
      ru: 'Материалы и изделия для медицины: биокерамика и имплантаты, каркасы для восстановления костной ткани, биосовместимые покрытия, обработка поверхности медицинских изделий.',
      en: 'Materials and devices for medicine: bioceramics and implants, scaffolds for bone regeneration, biocompatible coatings and surface treatment of medical devices.',
    },
    match: {
      scope: { fields: [13, 16, 22, 25, 35] },
      name: /\bbone\b|tissue engineering|scaffold|implant|dental (material|ceramic|restoration|zirconia)|orthop|prosthe|bioceramic|hydroxyapatite|calcium phosphate|biocompatib|bioactive glass|biodegradable (metal|magnesium|alloy)|antibacterial (coating|surface)|medical device|bioprint|biomaterial/i,
      exclude: /outcome|clinical|surgery|surgical outcome|patient|periodont|orthodont|endodont|caries|oral health|drug delivery|vaccine/i,
    },
  },
  {
    id: 'additive-manufacturing',
    name: { ru: 'Аддитивные технологии', en: 'Additive manufacturing' },
    short: { ru: 'Аддитивные технологии', en: 'Additive manufacturing' },
    summary: {
      ru: 'Послойный синтез изделий из металлических, керамических и полимерных материалов: селективное лазерное сплавление, прямое лазерное выращивание, проволочно-дуговая наплавка; материалы, режимы и постобработка.',
      en: 'Layer-by-layer fabrication from metal, ceramic and polymer feedstocks: laser powder bed fusion, directed energy deposition, wire-arc deposition; materials, process parameters and post-processing.',
    },
    match: {
      scope: { fields: [...PHYSICAL, 17, 26] },
      name: /additive manufactur|3d print|three-dimensional print|selective laser (melt|sinter)|powder bed fusion|laser powder bed|directed energy deposition|direct (metal )?laser (deposition|sintering)|wire (and )?arc additive|4d print|stereolithograph|fused (deposition|filament)|rapid prototyp/i,
    },
  },
  {
    id: 'condition-monitoring',
    name: { ru: 'Диагностика, мониторинг и надёжность оборудования', en: 'Condition monitoring, diagnostics and reliability' },
    short: { ru: 'Диагностика и надёжность', en: 'Monitoring & reliability' },
    summary: {
      ru: 'Контроль состояния станков, инструмента и технологических процессов по вибрации, акустической эмиссии и другим сигналам; неразрушающий контроль, надёжность, прогнозирование ресурса и предиктивное обслуживание.',
      en: 'Monitoring the condition of machine tools, cutting tools and processes from vibration, acoustic emission and other signals; non-destructive testing, reliability, remaining-life prediction and predictive maintenance.',
    },
    match: {
      scope: { fields: [21, 22, 25, 31] },
      name: /fault (diagnos|detection)|condition monitoring|machine (health|condition)|prognos|remaining useful life|predictive maintenance|vibration (analysis|signal|monitoring|based)|acoustic emission|structural health monitoring|non-?destructive (testing|evaluation|inspection)|ultrasonic (testing|inspection|nondestructive)|eddy current|damage (detection|identification)|tool (condition|wear) monitoring|reliability|maintenance/i,
      exclude: /bridge|seismic|earthquake|building|civil|concrete|medical|patient|software|power (system|grid)|smart grid/i,
    },
  },
  {
    id: 'robotics',
    name: { ru: 'Робототехника', en: 'Robotics' },
    short: { ru: 'Робототехника', en: 'Robotics' },
    summary: {
      ru: 'Кинематика и динамика манипуляторов, параллельные механизмы, управление движением, мобильные и коллаборативные роботы, роботизация технологических операций.',
      en: 'Kinematics and dynamics of manipulators, parallel mechanisms, motion control, mobile and collaborative robots, robotic automation of manufacturing operations.',
    },
    match: {
      scope: { fields: [17, 22, 26, 31] },
      name: /robot|manipulator|exoskeleton|legged locomotion|humanoid|gripper|grasp|teleoperat|haptic|parallel (mechanism|manipulator|kinematic)|cable-driven|unmanned|\buav\b|drone|path planning|motion planning/i,
      exclude: /surg/i,
    },
  },
  {
    id: 'coatings-tribology',
    name: { ru: 'Покрытия, инженерия поверхности и трибология', en: 'Coatings, surface engineering and tribology' },
    short: { ru: 'Покрытия и трибология', en: 'Coatings & tribology' },
    summary: {
      ru: 'Износостойкие и функциональные покрытия, в том числе вакуумно-дуговые и магнетронные; упрочнение и модификация поверхности; трение, изнашивание и смазка; коррозионная стойкость.',
      en: 'Wear-resistant and functional coatings, including cathodic-arc and magnetron-sputtered films; surface hardening and modification; friction, wear and lubrication; corrosion resistance.',
    },
    match: {
      scope: { fields: PHYSICAL },
      name: /coating|thin film|surface (treatment|modification|engineering|hardening|integrity|nanocrystalli)|nitrid(ing|e coating)|carburi[sz]|boriding|physical vapou?r|chemical vapou?r|\bpvd\b|\bcvd\b|diamond-like|hard (film|coating)|tribolog|\bwear\b|friction|lubric|corrosion|oxidation (resistance|behavio)|anodi[csz]|electrodeposit|electroless|thermal spray|cold spray|plasma electrolytic|micro-?arc oxidation|electroplat/i,
      exclude: /tooth|dental|soil|coastal|river|sediment|concrete|cement|asphalt|biofilm|food|skin|cartilage|knee|\bhip\b|solar cell|perovskite|photovoltaic|transistor|semiconductor|battery|\belectrodes?\b|catalys|magnetic|ferroelectric|superconduct|spintronic|optical|tool wear|cutting|machining|milling|turning|drilling/i,
    },
  },
  {
    id: 'laser-edm-plasma',
    name: { ru: 'Электрофизические, лазерные и плазменные технологии', en: 'Laser, electrical discharge and plasma processing' },
    short: { ru: 'Электрофизические технологии', en: 'Laser, EDM & plasma' },
    summary: {
      ru: 'Электроэрозионная и электрохимическая обработка, лазерная обработка материалов, плазменные и пучковые методы модификации поверхности, ультразвуковые и гидроабразивные технологии.',
      en: 'Electrical discharge and electrochemical machining, laser materials processing, plasma and beam methods of surface modification, ultrasonic and abrasive waterjet technologies.',
    },
    match: {
      scope: { fields: PHYSICAL },
      name: /laser|electrical discharge|electro-?discharge|spark erosion|electrochemical machin|plasma|ion beam|ion implant|ion-surface|ion (bombard|irradiat)|electron beam|sputter|vacuum arc|glow discharge|arc discharge|ultrasonic(ally)? (assisted|machin|vibration)|water ?jet|abrasive jet|femtosecond|ultrashort pulse|micro-?machin|micro-?fabricat|magnetron/i,
      exclude: /fusion|tokamak|stellarator|inertial confinement|laser.?plasma (interaction|accelerat)|wakefield|astro|solar|ionosph|magnetosph|space plasma|cosmic|dusty plasma|quark|gluon|nuclear|lidar|spectroscop|optical (communication|fiber)|fiber laser|frequency comb|laser cooling|atom trap|quantum|semiconductor laser|laser diode|random laser|plasmonic|blood|cancer|medic|therap|skin|dermat|ophthalm|dental/i,
    },
  },
  {
    id: 'machining',
    name: { ru: 'Обработка резанием и режущий инструмент', en: 'Machining and cutting tools' },
    short: { ru: 'Обработка резанием', en: 'Machining' },
    summary: {
      ru: 'Точение, фрезерование, сверление и шлифование, износ и стойкость инструмента, качество поверхностного слоя, выбор режимов обработки труднообрабатываемых материалов.',
      en: 'Turning, milling, drilling and grinding, tool wear and tool life, surface integrity, and process optimisation for difficult-to-cut materials.',
    },
    match: {
      scope: { fields: [22, 25] },
      name: /machining|machinability|machined|cutting|milling|turning|drilling|grinding|polishing|finishing|abrasive|chip formation|tool (wear|life|geometry)|\bburr|boring|reaming|broaching|honing|lapping|surface roughness|chatter|material removal/i,
      exclude: /cutting.?edge|cutting plane|graph|drilling (fluid|mud|rig|well)|\boil\b|\bgas\b|borehole|wellbore|grinding (mill|media|ore)|comminut|wood|timber|textile|food|agricultur|electrical machine/i,
    },
  },
  {
    id: 'forming-welding',
    name: { ru: 'Обработка давлением, сварка и литьё', en: 'Metal forming, welding and casting' },
    short: { ru: 'Давление, сварка, литьё', en: 'Forming & welding' },
    summary: {
      ru: 'Формообразование металлов пластическим деформированием, интенсивная пластическая деформация, сварка и соединение материалов, литейные технологии.',
      en: 'Shaping metals by plastic deformation, severe plastic deformation, welding and joining of materials, casting technologies.',
    },
    match: {
      scope: { fields: [22, 25] },
      name: /forming|forging|rolling|extrusion|stamping|sheet metal|deep drawing|bending|severe plastic|equal channel|high pressure torsion|welding|\bweld|brazing|soldering|joining|riveting|casting|foundry|solidification/i,
      exclude: /beamforming|beam forming|image forming|pattern forming|food|pharm|injection mold|film blowing|seismic|rolling bearing|rolling element/i,
    },
  },
  {
    id: 'ceramics-composites',
    name: { ru: 'Керамика, композиты и порошковые материалы', en: 'Ceramics, composites and powder materials' },
    short: { ru: 'Керамика и композиты', en: 'Ceramics & composites' },
    summary: {
      ru: 'Конструкционная и инструментальная керамика, сверхтвёрдые и композиционные материалы, наноструктурированные материалы, порошковая металлургия и спекание, в том числе искровое плазменное.',
      en: 'Structural and tool ceramics, superhard and composite materials, nanostructured materials, powder metallurgy and sintering, including spark plasma sintering.',
    },
    match: {
      scope: { fields: [16, 22, 25, 31] },
      name: /ceramic|composite|sinter|powder metallurg|metal powder|cermet|hard ?metal|cemented carbide|tungsten carbide|carbide|boride|zirconia|alumina|silicon nitride|max phase|\bglass(es)?\b|refractor|ultra-?high temperature|nanocomposite|nanostructured material|diamond|superhard|boron nitride|self-propagating|combustion synthesis|mechanical alloying/i,
      exclude: /concrete|cement|asphalt|geopolymer|wood|natural fiber|bamboo|textile|food|packaging|dental|\bbone\b|tissue|electrolyte|battery|cathode|anode|fuel cell|piezoelectric|ferroelectric|dielectric|microwave absor|thermoelectric|phosphor|luminesc|photocatal|catalys|membrane|polymer|rubber|epoxy|hydrogel|quantum|nv center|semiconductor|metallic glass|optical fiber|glass fiber/i,
    },
  },
  {
    id: 'metals-alloys',
    name: { ru: 'Металлические материалы и сплавы', en: 'Metallic materials and alloys' },
    short: { ru: 'Металлы и сплавы', en: 'Metals & alloys' },
    summary: {
      ru: 'Структура и свойства сталей, титановых, алюминиевых, никелевых и высокоэнтропийных сплавов, термическая обработка, механическое поведение металлов.',
      en: 'Structure and properties of steels, titanium, aluminium, nickel and high-entropy alloys, heat treatment and the mechanical behaviour of metals.',
    },
    match: {
      whole: { subfields: [2506] },
      scope: { fields: [22, 25, 31] },
      name: /alloy|steel|titanium|alumin(i)?um|magnesium|nickel|copper|superalloy|high-entropy|intermetallic|shape memory|martensit|austenit|metallic glass|amorphous (alloy|metal)|hydrogen embrittlement|heat treatment|metallurg|microstructur/i,
      exclude: /nanoparticle|catalys|battery|hydrogen storage|electrode|semiconductor|magnetic|superconduct/i,
    },
  },
  {
    id: 'metrology-quality',
    name: { ru: 'Метрология, измерения и качество', en: 'Metrology, measurement and quality' },
    short: { ru: 'Метрология и качество', en: 'Metrology & quality' },
    summary: {
      ru: 'Методы и средства измерений, координатная и оптическая метрология, контроль геометрии и шероховатости, машинное зрение для контроля, обеспечение и управление качеством продукции.',
      en: 'Measurement methods and instruments, coordinate and optical metrology, inspection of geometry and roughness, machine vision for inspection, quality assurance and management.',
    },
    match: {
      scope: { fields: [14, 17, 18, 22, 31] },
      name: /metrolog|measur|calibrat|interferomet|profilometr|surface (texture|topography)|uncertainty (analysis|evaluation)|gauge|toleranc|inspection|optical testing|3d (scanning|reconstruction)|photogrammetr|machine vision|vision system|defect detection|\bquality\b|six sigma|statistical process control|standardi[sz]ation/i,
      exclude: /blood pressure|clinical|patient|health|water quality|air quality|soil|food|quality of life|software quality|service quality|education|teaching|psycholog|questionnaire|radiation dose|neutron|particle physics|financial|accounting/i,
    },
  },
  {
    id: 'ai-data',
    name: { ru: 'Искусственный интеллект и анализ данных', en: 'Artificial intelligence and data analytics' },
    short: { ru: 'ИИ и анализ данных', en: 'AI & data' },
    summary: {
      ru: 'Машинное обучение и нейросетевые модели, компьютерное зрение и распознавание образов, интеллектуальный анализ данных — в том числе для задач промышленности.',
      en: 'Machine learning and neural network models, computer vision and pattern recognition, data mining — including industrial applications.',
    },
    match: {
      whole: { subfields: [1702, 1707] },
      scope: { fields: [17, 22] },
      name: /machine learning|deep learning|neural network|data mining|big data|computer vision|image (recognition|processing|segmentation|classification)|pattern recognition|reinforcement learning|explainable|natural language|language model|fuzzy (logic|system)|genetic algorithm|evolutionary (algorithm|computation)|swarm intelligence|metaheuristic/i,
      exclude: /medical image|brain|eeg|ecg|cancer|disease|clinical|protein|genom/i,
    },
  },
  {
    id: 'digital-manufacturing',
    name: { ru: 'Цифровое производство и промышленные системы', en: 'Digital manufacturing and industrial systems' },
    short: { ru: 'Цифровое производство', en: 'Digital manufacturing' },
    summary: {
      ru: 'Цифровые двойники и Индустрия 4.0, промышленный интернет вещей, планирование и диспетчеризация производства, САПР и управление жизненным циклом изделий, гибкие производственные системы.',
      en: 'Digital twins and Industry 4.0, the industrial internet of things, production planning and scheduling, CAD/CAM and product lifecycle management, flexible manufacturing systems.',
    },
    match: {
      scope: { fields: [14, 17, 18, 22] },
      name: /industry 4\.0|industrie 4|digital twin|smart (manufacturing|factor|production)|cyber-?physical|manufacturing (system|execution|process|planning|optimization|technolog)|production (planning|scheduling|system|management)|scheduling|\blean\b|reconfigurable|flexible manufactur|computer-aided|\bcad\b|\bcam\b|product lifecycle|\bplm\b|product (development|design|customi[sz]ation)|design optimi[sz]ation|virtual (reality|commissioning)|augmented reality|digital transformation|industrial internet|internet of things|\biiot\b|industrial (iot|engineering|technolog)|supply chain|logistic|enterprise (system|resource)|\berp\b|maintenance (management|planning)/i,
      exclude: /health|hospital|patient|agricultur|farm|food|touris|education|construction (project|management)|building information|\bbim\b|transport(ation)? network|urban|cities|\bcity\b|energy (market|management)|power system|smart grid/i,
    },
  },
  {
    id: 'machine-tools-control',
    name: { ru: 'Станки, приводы и системы управления', en: 'Machine tools, drives and control systems' },
    short: { ru: 'Станки и управление', en: 'Machine tools & control' },
    summary: {
      ru: 'Конструкция и динамика станков и механизмов, приводы и мехатронные узлы, системы ЧПУ и управления технологическим оборудованием, гидро- и пневмосистемы.',
      en: 'Design and dynamics of machine tools and mechanisms, drives and mechatronic units, CNC and control systems for manufacturing equipment, hydraulic and pneumatic systems.',
    },
    match: {
      scope: { fields: [17, 22] },
      name: /machine tool|\bcnc\b|numerical(ly)? control|spindle|feed drive|servo|motion control|linear motor|ball screw|guideway|bearing|\bgear|transmission|mechanism|kinematic|vibration|dynamics (of|analysis)|hydraulic|pneumatic|actuator|electric drive|drive system|electric(al)? motor|induction motor|permanent magnet (synchronous|motor)|motor control|control system|controller|\bpid\b|model predictive|sliding mode|adaptive control|iterative learning|nonlinear control|system identification|\bplc\b|programmable logic|scada|industrial (control|automation)|automation|mechatronic/i,
      exclude: /power (system|grid)|smart grid|microgrid|\bwind\b|photovoltaic|battery|vehicle|traffic|aircraft|spacecraft|satellite|\bship|marine|railway|automotive|building|hvac|biolog|medic|heart|brain|epidemic|wireless|network(ed)? control|transmission line|power transmission|data transmission/i,
    },
  },
  {
    id: 'software-it',
    name: { ru: 'Программная инженерия и информационные системы', en: 'Software engineering and information systems' },
    short: { ru: 'ПО и информационные системы', en: 'Software & IT systems' },
    summary: {
      ru: 'Разработка программного обеспечения, информационные и корпоративные системы, компьютерные сети и распределённые вычисления, интернет вещей, информационная безопасность.',
      en: 'Software development, information and enterprise systems, computer networks and distributed computing, the internet of things, information security.',
    },
    match: {
      whole: { subfields: [1705, 1708, 1710, 1712] },
      scope: { fields: [17] },
      name: /software|information system|database|cloud|edge computing|\biot\b|internet of things|blockchain|cyber ?security|network security|distributed computing|\bweb\b/i,
      exclude: /medical|health|clinical|patient|genom|protein/i,
    },
  },
  {
    id: 'modeling-mechanics',
    name: { ru: 'Механика и математическое моделирование', en: 'Mechanics and mathematical modelling' },
    short: { ru: 'Механика и моделирование', en: 'Mechanics & modelling' },
    summary: {
      ru: 'Математические модели и численные методы, механика деформируемого твёрдого тела, разрушение и усталость, теплообмен и гидродинамика в технических системах, прикладная математика.',
      en: 'Mathematical models and numerical methods, solid mechanics, fracture and fatigue, heat transfer and fluid dynamics in engineering systems, applied mathematics.',
    },
    match: {
      whole: { fields: [26] },
      scope: { fields: [17, 22, 25, 31] },
      name: /simulation|modell?ing|numerical (method|simulation|analysis)|finite element|boundary element|differential equation|mathematical model|computational (mechanics|fluid)|elasticity|plasticity|viscoelast|fracture|fatigue|\bcrack|stress (analysis|concentration)|contact mechanics|thermoelast|heat (transfer|conduction)|thermal (analysis|stress)|fluid (dynamics|flow)|\bcfd\b|turbulen|topology optimi[sz]ation|inverse problem|wave propagation|stability analysis|nonlinear dynamics/i,
      exclude: /biolog|medic|blood|brain|heart|neur|epidemi|financ|econom/i,
    },
  },
  {
    id: 'industrial-economics',
    name: { ru: 'Экономика и управление промышленностью', en: 'Industrial economics and management' },
    short: { ru: 'Экономика промышленности', en: 'Industrial economics' },
    summary: {
      ru: 'Экономика промышленных предприятий, инновации и технологическое развитие, управление производством и персоналом, цифровая экономика.',
      en: 'Economics of industrial enterprises, innovation and technological development, management of production and personnel, the digital economy.',
    },
    match: {
      whole: { fields: [14, 20] },
      scope: { fields: [18, 33] },
      name: /econom|innovation|management|enterprise|industr|business|entrepreneur|investment|financ|labou?r|human (resource|capital)|personnel|regional development|import substitution|technolog(y|ical) (transfer|development|policy)/i,
    },
  },
  {
    id: 'engineering-education',
    name: { ru: 'Инженерное образование', en: 'Engineering education' },
    short: { ru: 'Инженерное образование', en: 'Engineering education' },
    summary: {
      ru: 'Подготовка инженерных кадров: образовательные программы и технологии, практико-ориентированное и цифровое обучение, развитие профессиональных компетенций.',
      en: 'Training engineers: curricula and educational technologies, practice-oriented and digital learning, development of professional competences.',
    },
    match: {
      whole: { subfields: [3304] },
      scope: { fields: [12, 17, 33] },
      name: /education|teaching|curricul|student|e-learning|\bmooc|pedagog|higher education/i,
    },
  },
];
