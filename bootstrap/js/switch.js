$(document).ready(function(){
   var cl  = $(".mui-switch");
   for(var i=0;i<cl.length;i++){
        if(cl[i].checked){
            cl[i].nextSibling.innerText='开启';
            cl[i].nextSibling.style.color="#FFFFFF";
            cl[i].nextSibling.style.marginLeft='0px';
        }else{
            cl[i].nextSibling.innerText='关闭';
            cl[i].nextSibling.style.color="#D2D2D2";
            cl[i].nextSibling.style.marginLeft='16px';
        }
   }
   cl.click(function(){
        if(this.checked){
            this.nextSibling.innerText='开启';
            this.nextSibling.style.color="#FFFFFF";
            this.nextSibling.style.marginLeft='0px';
        }else{
            this.nextSibling.innerText='关闭';
            this.nextSibling.style.color="#D2D2D2";
            this.nextSibling.style.marginLeft='16px';                
            
        }
   })
})
