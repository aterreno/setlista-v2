# Code quality todos:
- add sonarcubbe, respect rules https://rules.sonarsource.com/typescript/ and add it to the PROJECT_RULES
- add dev environment: it would break so many things with claude code
    [local, docker, dev, prod]
- add end to end tests to promote dev to prod, i.e. search for an artist with end2end tooling
- Improve test coverage:
  src/infrastructure/repositories |   64.85 |    36.03 |   66.66 |   66.37 |
  setlist-repository-impl.ts     |   57.36 |    36.03 |   58.62 |   58.82 | 94,121-122,133-146,163-175,206-217,224-228,251-305,321,364,375-378,401,441,453-466,486-492
- fix the dependabot Pull Requests
- add snyk? or dependabot is enough?

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
- add little map of the venue if possible (image)
- add instagram shots (search for it, insta has api), search for venue/artist
- The whole thing needs a better UX
- The whole thing needs an explaination of why - relive a concert or 'prep' before going to a concert, if it's an artist that the user does not know well.
