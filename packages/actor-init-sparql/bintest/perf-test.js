const newEngine = require('../').newEngine;
const myEngine = newEngine();

const query1 = `SELECT ?movie ?title ?name
WHERE {
  ?movie dbpedia-owl:starring [ rdfs:label "Brad Pitt"@en ];
         rdfs:label ?title;
         dbpedia-owl:director [ rdfs:label ?name ].
  FILTER LANGMATCHES(LANG(?title), "EN")
  FILTER LANGMATCHES(LANG(?name),  "EN")
}`;
const query2 = `SELECT * {
     ?s ?p ?o} LIMIT 300`;
const query3 = `SELECT *
WHERE {
  ?s rdfs:label "Brad Pitt"@en
}`;

const ITERATIONS = 10;

(async function() {
  console.time('duration');
  for (let i = 0; i < ITERATIONS; i++) {
    const result = await myEngine.query(query1, {sources: ['http://fragments.dbpedia.org/2016-04/en']});
    result.bindingsStream.on('data', (d) => {
      // Ignore output
    });
    result.bindingsStream.on('error', () => console.error('a'));
    await new Promise((resolve) => result.bindingsStream.on('end', resolve));
  }
  console.timeEnd('duration');
  logTrackedEvents();
})();
