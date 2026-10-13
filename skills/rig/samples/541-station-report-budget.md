# 541 - Station Report Budget

```rig
import { agent, p, s, timeout } from "rig";

// Agent role: summarize as many weather stations as possible from the log within the timeout budget.
const stationSummarizer = agent({
  model: "small",
  addons: timeout({ timeout: 8_000 }),
  instructions: p`Read the multi-station weather log below:
${p.bash("printf '%s\\n' \"STATION: ALPHA-01 | DATE: 2024-05-01 | TEMP: 18C | WIND: 12km/h NE | SKY: clear\" \"STATION: ALPHA-01 | DATE: 2024-05-02 | TEMP: 20C | WIND: 15km/h NE | SKY: partly cloudy\" \"STATION: ALPHA-01 | DATE: 2024-05-03 | TEMP: 17C | WIND: 22km/h N | SKY: rain showers\" \"STATION: BRAVO-02 | DATE: 2024-05-01 | TEMP: 9C | WIND: 30km/h W | SKY: overcast\" \"STATION: BRAVO-02 | DATE: 2024-05-02 | TEMP: 7C | WIND: 35km/h W | SKY: snow flurries\" \"STATION: BRAVO-02 | DATE: 2024-05-03 | TEMP: 10C | WIND: 18km/h SW | SKY: clear\" \"STATION: CHARLIE-03 | DATE: 2024-05-01 | TEMP: 29C | WIND: 8km/h S | SKY: hot and humid\" \"STATION: CHARLIE-03 | DATE: 2024-05-02 | TEMP: 31C | WIND: 6km/h S | SKY: heat advisory\" \"STATION: CHARLIE-03 | DATE: 2024-05-03 | TEMP: 28C | WIND: 10km/h SE | SKY: thunderstorms\" \"STATION: DELTA-04 | DATE: 2024-05-01 | TEMP: 2C | WIND: 40km/h N | SKY: blizzard warning\" \"STATION: DELTA-04 | DATE: 2024-05-02 | TEMP: -1C | WIND: 45km/h N | SKY: heavy snow\" \"STATION: DELTA-04 | DATE: 2024-05-03 | TEMP: 1C | WIND: 25km/h NW | SKY: clearing\" \"STATION: ECHO-05 | DATE: 2024-05-01 | TEMP: 24C | WIND: 14km/h E | SKY: sunny\" \"STATION: ECHO-05 | DATE: 2024-05-02 | TEMP: 25C | WIND: 12km/h E | SKY: sunny\" \"STATION: ECHO-05 | DATE: 2024-05-03 | TEMP: 23C | WIND: 16km/h SE | SKY: scattered clouds\"")}

Process the stations strictly in the order they first appear (ALPHA-01, BRAVO-02, CHARLIE-03, DELTA-04, ECHO-05). For each station you have time to finish before the timeout budget expires, produce one summary entry with the station name and a one-sentence description of its conditions trend across the logged days. Stop immediately once the budget is tight rather than rushing an incomplete entry. Report how many stations you fully summarized, the list of completed summaries in order, and whether you had to stop early due to the timeout budget (truncatedDueToBudget).`,
  output: s.object({
    stationsSummarized: s.int,
    summaries: s.array(s.object({
      station: s.string,
      conditions: s.string,
    })),
    truncatedDueToBudget: s.boolean,
  }),
});

export default stationSummarizer;
```
