- add sentry
- add google analytics
- add dashboards in aws and alerts 
    Set alerts for:
    High error rate
    Long Lambda durations
    Increased cold starts
    Frontend unhandled exceptions
    Backend timeout/errors per endpoint
- add little map of the venue if possible (image)
- add instagram shots (search for it, insta has api), search for venue/artist
- toni@Tonis-MacBook-Air setlista % docker compose up
    WARN[0000] /Users/toni/code/setlista/docker-compose.yml: the attribute `version` is obsolete, it will be ignored, please remove it to avoid potential confusion
    Compose can now delegate builds to bake for better performance.
     To do so, set COMPOSE_BAKE=true.
- Search for Ryan Adams Paris still doesn't work / Artist and specific city/venue substring
This search https://www.setlist.fm/search?query=Ryan+Adams+Paris
Returns this https://www.setlist.fm/setlist/ryan-adams/2024/le-bataclan-paris-france-2b50b8ca.html
- add dev environment: it would break so many things with this shitty claude code
    [local, docker, dev, prod]
- Test coverage:
  src/infrastructure/repositories |   64.85 |    36.03 |   66.66 |   66.37 |
  setlist-repository-impl.ts     |   57.36 |    36.03 |   58.62 |   58.82 | 94,121-122,133-146,163-175,206-217,224-228,251-305,321,364,375-378,401,441,453-466,486-492

