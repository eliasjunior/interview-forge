Good. First ill try to draw some  examples. tunderstand the pattern


for example

aabbc -> bbcaa

accca -> cccac



I need to find the split index(break point), a pseudo code would be

lets get 'accca' -> 'cccac'

lets find the candidate, first would be 'c' index 3 in S1

so substring here 'ca' == 'cc' in S2 

next will be 'cca' == 'cca' YES, found split, 'ccc + ac'

so S1 -> cca + ac, the pointers here are:
last index -> p1, and p1 + 1 to 0, cca + ac








