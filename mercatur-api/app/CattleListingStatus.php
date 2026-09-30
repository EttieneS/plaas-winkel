<?php

namespace App;

enum CattleListingStatus: string
{
    case Draft = 'DRAFT';
    case Published = 'PUBLISHED';
    case Sold = 'SOLD';
    case Cancelled = 'CANCELLED';
}
