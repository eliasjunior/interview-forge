We would like you to create a java based backend application using REST.
It should contain the following endpoints;
 
* GET /api/interest-rates (get a list of current interest rates)
* POST /api/mortgage-check (post the parameters to calculate for a mortgage check)
The list of current mortgage rates should be created in memory on
application startup.

The mortgage rate object contains the fields; maturityPeriod (integer),
interestRate (Percentage) and lastUpdate (Timestamp)
The posted data for the mortgage check contains at least the fields;

income (Amount), 
maturityPeriod (integer), 
loanValue (Amount), 
homeValue(Amount).

The mortgage check return if the mortgage is feasible (boolean) and the
montly costs (Amount) of the mortgage.
 
Business rules that apply are
- a mortgage should not exceed 4 times the income
- a mortgage should not exceed the home value
 
Use the frameworks as you see fit to build and test this.