import {BasicAnnotationDescribe} from "../decorator-generator/BasicAnnotationDescribe";
import BasicBeanContainer from "../container/BasicBeanContainer";
import SimpleFactory from "../factory/SimpleFactory";
import ProxyHandlerRegister from "../register/ProxyHandlerRegister";
import AnnotationGenerator from "../decorator-generator/AnnotationGenerator";
import AnnotationUtils from "../utils/AnnotationUtils";
import {Section} from "./Section";
import {Property} from "./Property";
import SectionMethodBuilder from "../builder/SectionMethodBuilder";

class BeanDescribe extends BasicAnnotationDescribe {

    constructor() {
        super();
        Object.assign(this.params, {
            name: '',
            args: [],
            isSectionSurround: true,
            containerType: BasicBeanContainer
        })
    }

    storageClassDecorator(targetType) {
        super.storageClassDecorator(targetType);
        this.createBean(targetType);
    }

    createBean(targetType) {
        this.targetType = targetType;
        const name = this.beanName;
        this.originInstance = new targetType(...this.getParams('args'));
        const proxyRegister = new ProxyHandlerRegister();
        const container = this.container = SimpleFactory.getInstance(this.getParams('containerType'));
        this.targetBean = container.getBean(name);
        if (!(this.targetBean && this.targetBean.constructor === targetType)) {
            this.proxyRegister(proxyRegister);
            const proxyInstance = new Proxy(this.originInstance, proxyRegister.export());
            container.setBean(name, proxyInstance);
            this.targetBean = proxyInstance;
        }
        this.onCreated();
    }

    proxyRegister(proxy) {
        this.wireProperty(proxy);
        this.applySections(proxy);
    }

    wireProperty(proxy) {
        for (let field of AnnotationUtils.getPropertyNames(this.originInstance)) {
            const propertyEntity = AnnotationUtils.getPropertyEntity(this.originInstance, field);
            if (propertyEntity) {
                propertyEntity.getAnnotationsByType(Property).forEach(property => {
                    property.hookProperty({proxy, container: this.container});
                });
            }
        }
    }

    applySections(proxy) {
        // get function
        proxy.register('get',
            (args, {next}) => {
                const [target, property, rec] = args;
                const origin = Reflect.get(...args);
                const propertyEntity = AnnotationUtils.getPropertyEntity(target, property);
                if (typeof origin === 'function' && propertyEntity && propertyEntity.hasAnnotations(Section)) {
                    const builder = new SectionMethodBuilder(propertyEntity, target);
                    if (!this.getParams('isSectionSurround')) {
                        return builder.build().bind(rec);
                    }
                    return builder.isSurroundSection().build().bind(rec);
                } else {
                    next();
                }
            }
        );

        // get other
        proxy.register('get', (args, {next}) => {
            const [target, property, rec] = args;
            const value = Reflect.get(...args);
            const get_value = v => v;
            const propertyEntity = AnnotationUtils.getPropertyEntity(target, property);
            if (propertyEntity && propertyEntity.hasAnnotations(Section)) {
                const builder = new SectionMethodBuilder(propertyEntity, target).setOriginMethod(get_value);
                if (!this.getParams('isSectionSurround')) {
                    return builder.build().bind(rec)(value);
                }
                return builder.isSurroundSection().build().bind(rec)(value);
            } else {
                next();
            }
        })
    }

    onCreated() {
        // console.log(`Decorator type [${this.constructor.name}] works on the bean [${this.beanName}]`)
        for (let field of AnnotationUtils.getPropertyNames(this.originInstance)) {
            const propertyEntity = AnnotationUtils.getPropertyEntity(this.originInstance, field);
            if (propertyEntity) {
                propertyEntity.getAnnotationsByType(Property).forEach(property => {
                    property.onClassBuilt(propertyEntity, this);
                });
            }
        }
        // to be override
    }

    get beanName() {
        return this.getParams('name') || this.targetType.name;
    }

    onReturn() {
        // override
        const proxyRegister = new ProxyHandlerRegister();
        proxyRegister.register('construct', () => this.targetBean);
        return new Proxy(this.targetType, proxyRegister.export());
    }

}

const Bean = AnnotationGenerator.generate(BeanDescribe);

export {BeanDescribe, Bean};