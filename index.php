<?
set_time_limit(300);

$path = "http://labs.dinahmoe.com/plink/sounds/";
$instruments = array('drums', 'voice', 'bee_long', '8bit_stab', 'bziaou', 'woody', 'syntklocka_stab', 'bassdist');
/*foreach($instruments as $inst){
    for($i = 1;$i<=16;$i++){
        $source = $inst . "_".$i.".ogg";
        
        $ch = curl_init($path.$source);
        $fp = fopen("sounds/".$source, "w");
        
        curl_setopt($ch, CURLOPT_FILE, $fp);
        curl_setopt($ch, CURLOPT_HEADER, 0);
        
        curl_exec($ch);
        curl_close($ch);
        fclose($fp); 
    }
}*/

/*$ch = curl_init("http://www.google.com/");
$fp = fopen("example_homepage.txt", "w");

curl_setopt($ch, CURLOPT_FILE, $fp);
curl_setopt($ch, CURLOPT_HEADER, 0);

curl_exec($ch);
curl_close($ch);
fclose($fp); */
?>
<!DOCTYPE HTML>
<head>
	<meta http-equiv="content-type" content="text/html" />
	<meta name="author" content="lolkittens" />
     
	<title>Untitled 2</title>
    <link rel=stylesheet href="style-0007.min.css">

</head>

<body>

<div id="container">
    <div id="main" role="main">
		<canvas id="music" width="1204" height="540" style="top: 50px; "></canvas>
        <img src="img/loading.gif" alt="loading.." id=loading />

  </div>
<script src="plink.js"></script>
<script src="//ajax.googleapis.com/ajax/libs/jquery/1.5.1/jquery.min.js"></script>
<script>window.jQuery||document.write("<script src='js/libs/jquery-1.5.1.min.js'>\x3C/script>");</script>

</body>
</html>