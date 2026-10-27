// Official programmes page + its faculty navigation, reviewed 2026-10-26.
// https://alhikmahuniversity.edu.ng/programmes/ (body/menu naming differs).
export const academics = {
 'Faculty of Agriculture':['Agriculture'],
 'Faculty of Education':['Science Education','Arts and Social Sciences Education','Educational Management and Counselling'],
 'Faculty of Basic Medical Sciences':['Medical Laboratory Science','Community Health','Public Health','Human Anatomy','Human Physiology'],
 'Faculty of Humanities and Social Sciences':['Sociology and Criminology','Political Science and Public Administration','Mass Communication','Languages','Islamic Studies','History and International Studies'],
 'Faculty of Law':['Law'],
 'Faculty of Management Sciences':['Accounting','Finance','Banking and Finance','Economics','Business Administration'],
 'Faculty of Natural and Applied Sciences':['Chemical and Geological Sciences','Biological Sciences','Physical Sciences'],
 'Faculty of Computing, Engineering and Technology':['Computer Sciences','Computer Science','Data Science and Information Systems','Data Science'],
 'Faculty of Nursing Sciences':['Nursing Science'],
 'College of Health Sciences':['Medicine and Surgery']
};
export const optionsWithLegacy = (values, current) => [...new Set([...values, ...(current && !values.includes(current) ? [current] : [])])];
