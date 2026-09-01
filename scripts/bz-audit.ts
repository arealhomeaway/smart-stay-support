import { auditPortfolioMapping } from "@/lib/breezeway-mapping.server";
const persist = process.argv.includes("--persist");
const r = await auditPortfolioMapping({ persist });
console.log(JSON.stringify(r.counts,null,1), "changed",r.changed,"bzActive",r.breezewayActiveHomes,"bzTotal",r.breezewayTotalHomes);
console.log("non-verified:", JSON.stringify(r.rows.filter(x=>x.state!=="verified"),null,1).slice(0,3000));
