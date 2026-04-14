
pseudo code

find kth(k) {

   Node current;
   int s = 0; 
   // time complexity O(n)
   while(current.next != null) {
     s++;
     current = current.next;
   }

   if(k > s || s == 0) {
    return -1
   }

   while(current.next != null) {
     s--;
     current = current.next;
     if(s == k) {
        return current.value;
     }
   } 

   return -1 
}




