import { agent, s } from "rig";
// Agent role: merge local advice and language tips into one travel plan.
const localGuide = agent({ model: "typecheck", instructions: "Suggest authentic places and activities for a 3-day trip to Egypt.", output: s.object({ ideas: s.array(s.string) }) });
const languageTips = agent({ model: "typecheck", instructions: "Suggest communication tips for a 3-day trip to Egypt.", output: s.object({ tips: s.array(s.string) }) });
const travelPlanPort = agent({
  model: "typecheck",
  instructions: "Plan a 3-day trip to Egypt. Use localGuide and languageTips when helpful, then return one integrated itinerary.",
  output: s.object({ itinerary: s.array(s.string), tips: s.array(s.string) }),
  agents: { localGuide, languageTips },
});
export default travelPlanPort;
