import {Bean} from "../core/decorator/Bean";
import {Autowired} from "../core/decorator/Autowired";
import {Boot} from "../core/decorator/Boot";

@Bean
@Bean('poi')
class Class1 {
    l = 999;
}

@Bean
class Class2 {
    @Autowired({beanName: 'poi', isMapProperty: true})
    l;

    @Autowired('Class1')
    class2;
}

@Boot
class BootClass {
    @Autowired('Class1')
    class1;

    @Autowired('Class2')
    class2;

    main() {
        console.log(this.class2.l);
        console.log(this);
    }
}