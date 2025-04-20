Objects:

| Index | Name         | Type           | Position | Owner        |
|-------|--------------|----------------|----------|--------------|
| 0     | axe          | 13:weapon      | (-1,-1)  | 7:troll      |
| 1     | map          | 9:readable     | (-1,-1)  | 2:pirate     |
| 2     | sword        | 13:weapon      | (-1,-1)  | 2:pirate     |
| 3     | lamp         | 7:light source | (-1,-1)  | 3:trader     |
| 4     | key,golden   | 10:key         | (-1,-1)  | 1:lumberjack |
| 5     | coin         | 6:other        | (-1,-1)  | 12:baboon    |
| 6     | cutlass      | 13:weapon      | (1,1)    |              |
| 7     | book         | 9:readable     | (2,0)    |              |
| 8     | club         | 13:weapon      | (-1,-1)  | 11:king      |
| 9     | arm          | 13:weapon      | (-1,-1)  | 6:zombie     |
| 10    | mace         | 13:weapon      | (-1,-1)  | multiple     |
| 11    | spade        | 11:spade       | (-1,-1)  | 10:clerk     |
| 12    | flamethrower | 13:weapon      | (-1,-1)  | 4:dragon     |
| 13    | bread        | 1:food         | (-2,-2)  |              |
| 14    | walkman      | 3:walkman      | (0,0)    |              |
| 15    | cube         | 5:cube         | (0,1)    |              |
| 16    | beer         | 2:drink        | (-1,-1)  | 5:landlord   |
| 17    | chest,golden | 12:unmovable   | (-1,-1)  |              |
| 18    | chest,silver | 12:unmovable   | (-1,-1)  | 4:dragon     |
| 19    | purse        | 8:treasure     | (-1,-1)  | 7:troll      |
| 20    | sack         | 8:treasure     | (-1,-1)  | 11:king      |
| 21    | bag          | 8:treasure     | (-1,-1)  |              |
| 22    | wallet       | 8:treasure     | (-1,-1)  |              |
| 23    | tunica       | 4:armor        | (-1,-1)  | buried       |
| 24    | breastplate  | 4:armor        | (-1,-1)  | 3:trader     |
| 25    | armor        | 4:armor        | (-1,-1)  | 3:treader    |
| 26    | key,silver   | 10:key         | (-1,-1)  | 9:signmaker  |
| 27    | brush        | 6:other        | (-1,-1)  | 2:pirate     |
| 28    | key,gate     | 10:key         | (-1,-1)  | 8:guard      |
| 30    | sandwich     | 1:food         | (0,3)    |              |
| 31    | rum          | 2:drink        | (4,0)    |              |
| 32    | cat          | 1:food         | (1,3)    |              |
| 33    | dog          | 1:food         | (1,4)    |              |

Actors:

| Index | Name       | Position |
|-------|------------|----------|
| 0     | player     | (0,0)    |
| 1     | lumberjack | (1,1)    |
| 2     | pirate     | (4,0)    |
| 3     | trader     | (0,4)    |
| 4     | dragon     | (3,4)    |
| 5     | landlord   | (0,3)    |
| 6     | zombie     | (0,2)    |
| 7     | troll      | (1,0)    |
| 8     | guard      | (1,2)    |
| 9     | signmaker  | (1,3)    |
| 10    | clerk      | (2,4)    |
| 11    | king       | (3,0)    |
| 12    | baboon     | (2,1)    |

Object trade data:

| Actor        | Trade from | Trade to       |
|--------------|------------|----------------|
| 8:guard      | 14:walkman | 28:key,gate    |
| 3:trader     | 15:cube    | 3:lamp         |
| 3:trader     | 7:book     | 24:breastplate |
| 3:trader     | 9:arm      | 25:armor       |
| 1:lumberjack | 0:axe      | 4:key,golden   |
| 10:clerk     | 19:purse   | 11:spade       |
| 10:clerk     | 20:sack    | 11:spade       |
| 10:clerk     | 21:bag     | 11:spade       |
| 10:clerk     | 22:wallet  | 11:spade       |
| 9:signmaker  | 27:brush   | 26:key,silver  |
| 5:landlord   | 5:coin     | 16:beer        |
