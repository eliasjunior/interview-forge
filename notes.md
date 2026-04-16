deleteMiddle(Node target) {
   if target.next != null
      target.val = target.next.val 
      target.next = target.next.next
    }   
}