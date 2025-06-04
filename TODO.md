# Code quality todos:
- ESLINT rules are too weak
- codeQL should not look into tests 
- add sonarcube, respect rules https://rules.sonarsource.com/typescript/ and add it to the PROJECT_RULES
- add dev environment: it would break so many things with this code
    [local/npm, docker, dev, prod]
- add end to end tests to promote dev to prod, i.e. search for an artist with end2end search and spotify login working fine
- Improve test coverage

# NRFRs todos:
- add sentry
- add google analytics
- add dashboards in aws and alerts 
    Set alerts for:
    High error rate
    Long Lambda durations
    Increased cold starts
    Frontend unhandled exceptions
    Backend timeout/errors per endpoint

# Features todos:
- pagination is broken
- add little map of the venue if possible (image)
- add instagram shots (search for it, insta has api), search for venue/artist
- Better UX
- Explain Why/context to users - relive a concert or 'prep' before going to a concert, if it's an artist that the user does not know well, historic concerts of the artist from the past, etc.
